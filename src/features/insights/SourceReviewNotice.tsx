import { useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Link } from 'react-router-dom'
import type { SourceReview } from '../../api/types'
import { request } from '../../api/client'
import { useSession } from '../../auth/session'
import { describeError } from '../../lib/errors'
import { projectPath } from '../app/currentProject'

export function SourceReviewBadge({ review, compact = false }: { review?: SourceReview | null; compact?: boolean }) {
  if (!review || review.status === 'current') return null
  const text = review.status === 'changed' ? '원고가 바뀜 · 확인 필요' : '원문 확인 필요'
  // 좁은 자리(관계 그래프의 선 라벨)에서는 점만 보이고, 글은 화면 읽기 프로그램과 툴팁으로 전한다
  if (compact)
    return (
      <span className="source-review__dot" title={text}>
        <span className="visually-hidden">{text}</span>
      </span>
    )
  return <span className="source-review__badge">{text}</span>
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
          ? `기록한 뒤 원고의 ${
              review.changed_chapters
                .slice(0, 8)
                .map((n) => `${n}장`)
                .join(', ') +
              (review.changed_chapters.length > 8 ? ` 외 ${review.changed_chapters.length - 8}개 장` : '')
            }이 바뀌었어요. 이 기록이 아직 맞는지 확인해 주세요.`
          : '어느 원고를 보고 남긴 기록인지 알 수 없어요. 지금 원고와 맞는지 확인해 주세요.'}
      </p>
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
        <Button tone="outline" busy={busy} onClick={() => void confirm()}>
          확인했어요, 기록은 그대로
        </Button>
      )}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
    </aside>
  )
}
