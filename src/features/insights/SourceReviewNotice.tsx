import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SourceReview } from '../../api/types'
import { request } from '../../api/client'
import { useSession } from '../../auth/session'
import { describeError } from '../../lib/errors'
import { projectPath } from '../app/currentProject'

export function SourceReviewBadge({ review }: { review?: SourceReview | null }) {
  if (!review || review.status === 'current') return null
  return (
    <span className="source-review__badge">
      {review.status === 'changed' ? '원고 변경 · 재확인 필요' : '원문 확인 필요'}
    </span>
  )
}

export function SourceReviewNotice({
  review,
  projectId,
  endpoint,
  canEdit,
  onSaved,
}: {
  review?: SourceReview | null
  projectId: string
  endpoint: string
  canEdit: boolean
  onSaved: () => void
}) {
  const { withAuth } = useSession()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!review || review.status === 'current') return null
  const source = review
  async function confirm() {
    if (lock.current || !source.revision_token) return
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      await withAuth((token) =>
        request('POST', endpoint, { accessToken: token, body: { revision_token: source.revision_token } }),
      )
      onSaved()
    } catch (e) {
      setError(describeError(e))
      onSaved()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <aside className="source-review" aria-label="기록의 원문 확인">
      <SourceReviewBadge review={review} />
      <p>
        {review.status === 'changed'
          ? `확인 기준 원고에서 ${
              review.changed_chapters
                .slice(0, 8)
                .map((n) => `${n}장`)
                .join(', ') +
              (review.changed_chapters.length > 8 ? ` 외 ${review.changed_chapters.length - 8}개 장` : '')
            }이 바뀌었어요. 이 기록에 영향을 주는지 확인해 주세요.`
          : '이전 기록에는 확인 기준 원고가 없어요. 현재 원문과 대조해 주세요.'}
      </p>
      <p>저장된 관계·회수 상태는 작가의 기록이며, 변경된 내용을 자동으로 재검증한 결과가 아니에요.</p>
      {review.manuscript_id && (
        <Link
          target="_blank"
          rel="noopener noreferrer"
          className="text-link"
          to={projectPath(projectId, `manuscripts/${review.manuscript_id}`)}
        >
          원고 열기 (새 탭)
        </Link>
      )}
      {canEdit && review.revision_token && (
        <button type="button" className="btn btn--outline" disabled={busy} onClick={() => void confirm()}>
          {busy ? '확인 저장 중…' : '원문 확인 완료 · 기록 유지'}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </aside>
  )
}
