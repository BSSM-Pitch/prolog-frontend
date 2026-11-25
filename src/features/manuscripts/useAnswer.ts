import { useEffect, useState } from 'react'
import * as api from '../../api/manuscripts'
import type { QAMessage } from '../../api/types'
import { useSession } from '../../auth/session'
import { describeError } from '../../lib/errors'
import { useJobRequest } from '../../lib/useJobRequest'

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
  const message = latest && latest.message_id === target?.messageId ? latest : source
  const pending = message?.status === 'pending'
  const key = target ? `${target.projectId}/${target.manuscriptId}/${target.threadId}/${target.messageId}` : ''
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const retryRequest = useJobRequest<QAMessage>(key, setLatest)
  useEffect(() => { setError(null) }, [key])

  useEffect(() => {
    if (!target || !pending) return
    let cancelled = false
    const controller = new AbortController()
    let timer: number | undefined
    const receive = (m: QAMessage) => {
      if (!cancelled) { setLatest(m); setError(null) }
    }
    async function poll() {
      if (cancelled || !target) return
      try {
        const m = await withAuth((t) => api.getMessage(t, target.projectId, target.manuscriptId, target.threadId, target.messageId))
        receive(m)
        if (m.status !== 'pending') return
      } catch (e) { if (!cancelled) setError(describeError(e)) }
      if (!cancelled) timer = window.setTimeout(poll, 1500)
    }
    void withAuth((t) => api.streamMessage(t, target.projectId, target.manuscriptId, target.threadId, target.messageId, controller.signal, receive))
      .then(() => { if (!cancelled) void poll() })
      .catch(() => { if (!cancelled) void poll() })
    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timer)
    }
    // target 객체는 매 렌더 새로 만들어지므로 key로만 반응한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pending, withAuth, connectionAttempt])

  async function retry() {
    if (!target || pending) return
    setError(null)
    await retryRequest.run(() => withAuth((t) => api.retryMessage(t, target.projectId, target.manuscriptId, target.threadId, target.messageId)))
  }

  return {
    message, setMessage: setLatest, error: retryRequest.error ?? error, retry,
    retrying: retryRequest.busy,
    reconnect: () => { setError(null); setConnectionAttempt((value) => value + 1) },
  }
}
