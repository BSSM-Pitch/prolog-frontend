import { useEffect, useRef, useState } from 'react'
import * as api from '../../api/world'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { useJob } from '../../lib/useJob'
import { NarrativeSummary } from '../world/NarrativeSummary'

/** 관계·복선 탭에서 같은 원고 검토 결과를 이어서 보되, 탭에 맞는 후보만 보여 준다. */
export function NarrativeReview({ projectId, manuscriptId, kind, canEdit }: {
  projectId: string
  manuscriptId: string
  kind: 'relationships' | 'foreshadowings'
  canEdit: boolean
}) {
  const { withAuth } = useSession()
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const epoch = useRef(0)
  const lock = useRef(false)
  const check = useJob((token, id) => api.getConflictCheck(token, projectId, id), () => {})
  useEffect(() => {
    let cancelled = false
    const current = ++epoch.current
    withAuth((token) => api.latestNarrativeReview(token, projectId, manuscriptId))
      .then((job) => { if (!cancelled && current === epoch.current) check.setJob(job) })
      .catch((error) => { if (!cancelled) check.setError(describeError(error)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // The page keys this component by manuscript; navigation restores the saved review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, manuscriptId, withAuth])
  async function review() {
    if (lock.current || check.running || !canEdit) return
    lock.current = true
    epoch.current += 1
    setBusy(true)
    check.setError(null)
    try {
      check.setJob(await withAuth((token) => api.rescan(token, projectId, false, { manuscriptId, chapterId: '' })))
    } catch (error) {
      check.setError(describeError(error))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <NarrativeSummary
      job={check.job}
      projectId={projectId}
      scope={kind === 'relationships' ? 'relationship' : 'foreshadowing'}
      loading={loading}
      error={check.error}
      action={
        canEdit && (
          <Button tone="outline" busy={busy} disabled={loading || check.running} onClick={review}>
            {check.running ? '검사하는 중…' : check.job ? '다시 검사' : '원고 검사하기'}
          </Button>
        )
      }
    />
  )
}
