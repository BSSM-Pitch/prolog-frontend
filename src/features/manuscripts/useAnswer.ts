import { useCallback, useEffect, useState } from 'react'
import * as api from '../../api/manuscripts'
import type { QAMessage } from '../../api/types'
import { useSession } from '../../auth/session'
import { describeError } from '../../lib/errors'

interface Target {
  projectId: string
  manuscriptId: string
  threadId: string
  messageId: string
}

/**
 * AI 답변 메시지를 완료될 때까지 폴링한다 (AIQ 4.5).
 * source는 화면이 알고 있는 최신 메시지(예: 스레드를 불러온 값). 폴링·재시도로 받은 값이 같은 메시지면 그쪽을 우선한다.
 */
export function useAnswer(target: Target | null, source: QAMessage | null) {
  const { withAuth } = useSession()
  const [latest, setLatest] = useState<QAMessage | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 다른 메시지로 바뀌었으면 이전에 받은 값은 버린다
  const message = latest && (!source || latest.message_id === source.message_id) ? latest : source
  const pending = message?.status === 'pending'
  const key = target ? `${target.threadId}/${target.messageId}` : ''

  useEffect(() => {
    if (!target || !pending) return
    let cancelled = false
    const id = window.setInterval(() => {
      withAuth((t) => api.getMessage(t, target.projectId, target.manuscriptId, target.threadId, target.messageId))
        .then((m) => !cancelled && setLatest(m))
        .catch((e) => !cancelled && setError(describeError(e)))
    }, 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
    // target 객체는 매 렌더 새로 만들어지므로 key로만 반응한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pending, withAuth])

  const retry = useCallback(async () => {
    if (!target) return
    setError(null)
    try {
      setLatest(await withAuth((t) => api.retryMessage(t, target.projectId, target.manuscriptId, target.threadId, target.messageId)))
    } catch (e) {
      setError(describeError(e))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, withAuth])

  return { message, setMessage: setLatest, error, retry }
}
