import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import * as api from '../../api/manuscripts'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { useResource } from '../../lib/useResource'
import { projectPath } from '../app/currentProject'
import { AnswerCard } from '../manuscripts/AnswerCard'
import { useAnswer } from '../manuscripts/useAnswer'
import '../manuscripts/answer.css'

const questions = {
  relationships: '이 원고 전체에서 주요 인물 쌍의 관계 변화를 장 순서대로 검토해 줘. 각 관계의 최초 상태, 달라진 장과 사건, 현재 상태를 짧은 원문 근거와 함께 정리해 줘. 서로를 대하는 방향이 다르면 구분하고, 호칭과 별칭은 문맥으로 대조해 줘. 협력·용서·신뢰·연애를 혼동하거나 근거 없는 점수를 만들지 마. 작가가 관계 기록에 옮길 수 있도록 인물 쌍별로 변화가 있는 장을 빠짐없이 목록으로 써 줘. 불확실한 해석은 명시해 줘.',
  foreshadowings: '이 원고 전체의 복선과 미해결 질문을 검토해 줘. 후보마다 최초로 심은 장, 다시 이어진 장, 실제 회수된 장 또는 미해결 상태를 정리하고 각 단계의 짧은 원문 근거를 붙여 줘. 단순 재등장, 일부 진전, 오해의 해소, 실제 의미나 사건의 회수를 구분해 줘. 같은 색이나 단어만으로 다른 단서를 합치지 말고, 의도적으로 열린 결말을 오류로 단정하지 마. 작가가 복선 기록에 옮길 수 있는 후보별 목록으로 쓰고 근거가 부족하면 확정하지 마.',
}

/** The writer reviews source-backed suggestions before recording their interpretation. */
export function NarrativeReview({ projectId, manuscriptId, kind, canEdit }: {
  projectId: string
  manuscriptId: string
  kind: keyof typeof questions
  canEdit: boolean
}) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { withAuth } = useSession()
  const key = `${kind}_review`
  const threadId = params.get(key) ?? ''
  const detail = useResource(threadId ? (token) => api.getThread(token, projectId, manuscriptId, threadId) : null,
    [projectId, manuscriptId, threadId])
  const source = detail.data?.thread.thread_id === threadId
    ? detail.data.messages.findLast((message) => message.role === 'assistant') ?? null : null
  const answer = useAnswer(source ? { projectId, manuscriptId, threadId, messageId: source.message_id } : null, source)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function review() {
    if (busy || answer.message?.status === 'pending') return
    setBusy(true)
    setError(null)
    try {
      const result = await withAuth((token) => api.createThread(token, projectId, manuscriptId, {
        scope: 'whole', question: questions[kind],
      }))
      const next = new URLSearchParams(params)
      next.set('manuscript', manuscriptId)
      next.set(key, result.thread.thread_id)
      setParams(next, { replace: true })
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }
  const title = kind === 'relationships' ? '관계 변화' : '복선과 회수'
  return <section className="insight-review" aria-label={`AI ${title} 검토`}>
    <div className="insight-actions">
      <div>
        <h2 className="panel__title">원고에서 {title} 살펴보기</h2>
        <p className="page-desc">AI가 장별 근거를 정리해요. 해석을 확인한 뒤 아래 기록에 남겨 주세요.</p>
      </div>
      {canEdit && <Button tone="outline" busy={busy} disabled={answer.message?.status === 'pending'} onClick={review}>
        {threadId ? '현재 원고로 다시 검토' : `AI로 ${title} 검토`}
      </Button>}
    </div>
    {(error || detail.error || answer.error) && <p role="alert">{error || detail.error || answer.error}</p>}
    {detail.loading && !detail.data && <p role="status">검토 내용을 불러오고 있어요.</p>}
    {answer.message && <details open={answer.message.status !== 'completed'}>
      <summary>{answer.message.status === 'completed' ? '장별 검토 결과와 원문 근거 보기' : 'AI 검토 진행 상황'}</summary>
      <AnswerCard message={answer.message} error={answer.error} onRetry={answer.retry}
        onOpenCitation={(citation) => navigate(`${projectPath(projectId, `manuscripts/${manuscriptId}`)}?chapter=${citation.chapter_no}`, { state: { highlight: citation.quote } })} />
      <Link className="text-link" to={`${projectPath(projectId, 'ask')}?manuscript=${manuscriptId}&thread=${threadId}`}>이 검토에 이어서 질문하기</Link>
      <p className="page-desc">질문할 때 저장된 원고 기준의 제안입니다. 원고를 고쳤다면 다시 검토해 주세요.</p>
    </details>}
  </section>
}
