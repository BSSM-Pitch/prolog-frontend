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
 * 대기 중이면 1초마다 다시 묻고, 완료·실패가 되면 멈춘다.
 */
export function useAnswer(target: Target | null, initial: QAMessage | null) {
  const { withAuth } = useSession()
  const [message, setMessage] = useState<QAMessage | null>(initial)
  const [error, setError] = useState<string | null>(null)
  const pending = message?.status === 'pending'
  const key = target ? `${target.threadId}/${target.messageId}` : ''

  useEffect(() => {
    if (!target || !pending) return
    let cancelled = false
    const id = window.setInterval(() => {
      withAuth((t) => api.getMessage(t, target.projectId, target.manuscriptId, target.threadId, target.messageId))
        .then((m) => !cancelled && setMessage(m))
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
      setMessage(await withAuth((t) => api.retryMessage(t, target.projectId, target.manuscriptId, target.threadId, target.messageId)))
    } catch (e) {
      setError(describeError(e))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, withAuth])

  return { message, setMessage, error, retry }
}
