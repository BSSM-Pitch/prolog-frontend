import { useEffect, useState } from 'react'
import { request } from '../../api/client'
import { IS_REAL } from '../../api/config'
import { useSession } from '../../auth/session'
import { useJobRequest } from '../../lib/useJobRequest'
import { pollResource } from '../../lib/pollResource'
import { describeError } from '../../lib/errors'

export interface RelationshipDraft {
  draft_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  chapter_id: string
  source_hash: string
  analyzed_chars: number
  total_chars: number
  stale?: boolean
  result: {
    source_character_id: string | null
    target_character_id: string | null
    state: string
    trust: number | null
    event_title: string
    explanation: string
    evidence: string[]
  } | null
  error: string | null
}
export function useRelationshipDraft(projectId: string, manuscriptId: string, chapterId: string) {
  const { withAuth } = useSession()
  const [job, setJob] = useState<RelationshipDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const action = useJobRequest<RelationshipDraft>(`${projectId}:${manuscriptId}:${chapterId}`, setJob)
  const current = job?.chapter_id === chapterId ? job : null
  const draftId = current?.draft_id
  const running = current?.status === 'queued' || current?.status === 'running'
  async function generate(pair?: string[], retry = false) {
    if (!chapterId || !IS_REAL || action.busy || running) return
    setError(null)
    await action.run(() => withAuth((token) => request<RelationshipDraft>('POST', `/projects/${projectId}/relationship-drafts`, {
      accessToken: token,
      body: { manuscript_id: manuscriptId, chapter_id: chapterId, selected_pair: pair, retry },
    })))
  }
  useEffect(() => {
    setJob(null)
    setError(null)
    if (!chapterId || !IS_REAL) return
    // Server deduplication makes remounting and Strict Mode reuse the same work.
    void action.run(() => withAuth((token) => request<RelationshipDraft>('POST', `/projects/${projectId}/relationship-drafts`, {
      accessToken: token, body: { manuscript_id: manuscriptId, chapter_id: chapterId },
    })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, manuscriptId, chapterId, withAuth])
  useEffect(() => {
    if (!running || !draftId) return
    return pollResource({
      load: () => withAuth((token) => request<RelationshipDraft>('GET', `/projects/${projectId}/relationship-drafts/${draftId}`, { accessToken: token })),
      onValue: (next) => { setJob(next); setError(null) },
      onError: (cause) => setError(describeError(cause)),
      delay: (next) => !next || ['queued', 'running'].includes(next.status) ? 1200 : false,
    })
  }, [projectId, draftId, running, withAuth])
  return { job: current, busy: action.busy || running, error: action.error ?? error ?? current?.error, generate, available: IS_REAL }
}
