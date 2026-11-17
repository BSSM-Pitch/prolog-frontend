import { useEffect, useRef, useState } from 'react'
import * as api from '../../api/world'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { useJob } from '../../lib/useJob'
import { NarrativeSummary } from '../world/NarrativeSummary'

/** All three screens share one durable review of the same manuscript revision. */
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
  const title = kind === 'relationships' ? '관계 변화' : '복선과 회수'
  return <section className="insight-review" aria-label={`AI ${title} 검토`}>
    <div className="insight-actions">
      <div>
        <h2 className="panel__title">원고에서 {title} 살펴보기</h2>
        <p className="page-desc">규칙을 따로 등록하지 않아도 원고 전체에서 설정·관계·복선을 추적해요. 원고 화면과 같은 검사 결과를 이어서 봅니다.</p>
      </div>
      {canEdit && <Button tone="outline" busy={busy} disabled={loading || check.running} onClick={review}>
        {check.running ? '원고 전체 검사 중…' : check.job ? '현재 원고로 다시 검사' : '설정·관계·복선 자동 검사'}
      </Button>}
    </div>
    {check.error && <p role="alert">{check.error}</p>}
    {loading && <p role="status">검토 내용을 불러오고 있어요.</p>}
    {check.job && <NarrativeSummary job={check.job} projectId={projectId} kind={kind === 'relationships' ? 'relationship' : 'foreshadowing'} />}
  </section>
}
