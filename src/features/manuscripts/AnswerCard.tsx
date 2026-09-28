import type { Citation, QAMessage } from '../../api/types'
import { Button } from '../../components/Button'

interface AnswerCardProps {
  message: QAMessage | null
  error: string | null
  onRetry: () => void
  onOpenCitation?: (c: Citation) => void
  onEditQuestion?: () => void
}

/** AI 답변 한 개 — 대기(35) · 완료(02) · 실패(36) 상태 (Figma 상태 명세 1264:2911 AI 질문 행) */
export function AnswerCard({ message, error, onRetry, onOpenCitation, onEditQuestion }: AnswerCardProps) {
  if (!message) return null

  if (message.status === 'pending') {
    return (
      <div className="answer answer--pending" role="status">
        <span className="answer__spinner" aria-hidden="true" />
        <div>
          <p className="answer__title">원고에서 근거가 되는 문장을 찾고 있어요</p>
          <p className="answer__body">답변이 오는 동안 다른 화면으로 이동해도 괜찮아요. 준비되면 이 대화에 표시돼요.</p>
        </div>
      </div>
    )
  }

  if (message.status === 'failed') {
    return (
      <div className="answer answer--failed" role="alert">
        <p className="answer__title">답변을 만들지 못했어요</p>
        <p className="answer__body">
          {message.error?.message ?? '잠시 뒤 다시 시도해 주세요.'} 질문은 저장돼 있으니 다시 시도하면 같은 질문으로 답변을 만들어요.
        </p>
        {error && <p className="notice notice--error">{error}</p>}
        <div className="answer__actions">
          <Button onClick={onRetry}>다시 시도</Button>
          {onEditQuestion && (
            <Button tone="outline" onClick={onEditQuestion}>
              질문 수정
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="answer">
      <p className="answer__speaker">Prolog</p>
      <p className="answer__text">{message.content}</p>
      {message.citations.length > 0 && (
        <ul className="answer__citations">
          {message.citations.map((c) => (
            <li key={`${c.chapter_no}-${c.quote}`} className="citation">
              <p className="citation__label">
                근거 · {c.chapter_no}장{c.chapter_title ? ` ${c.chapter_title}` : ''}
              </p>
              <p className="citation__quote">“{c.quote}”</p>
              {onOpenCitation && (
                <button type="button" className="text-link citation__open" onClick={() => onOpenCitation(c)}>
                  {c.chapter_no}장 원문 보기
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="answer__caution">AI의 해석은 틀릴 수 있습니다. 근거 원문을 확인해 주세요.</p>
    </div>
  )
}
