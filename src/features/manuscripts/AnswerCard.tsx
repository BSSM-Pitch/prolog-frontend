import type { Citation, QAMessage } from '../../api/types'
import { Button } from '../../components/Button'
import { RichText } from '../../components/RichText'
import { AnalysisProgress } from '../../components/AnalysisProgress'

interface AnswerCardProps {
  message: QAMessage | null
  error: string | null
  onRetry: () => void
  retrying?: boolean
  onReconnect?: () => void
  onOpenCitation?: (c: Citation) => void
  onEditQuestion?: () => void
}

/** AI 답변 한 개 — 대기(35) · 완료(02) · 실패(36) 상태 (Figma 상태 명세 1264:2911 AI 질문 행) */
export function AnswerCard({ message, error, onRetry, retrying = false, onReconnect, onOpenCitation, onEditQuestion }: AnswerCardProps) {
  if (!message) return null

  if (retrying || message.status === 'pending') {
    return (
      <div className="answer answer--pending" role="status">
        <div className="answer__pending-text">
          <p className="answer__title">{retrying ? '다시 답변을 요청하고 있어요' : message.progress_stage === 'drafting' ? '원고와 설정에서 근거를 찾고 있어요' : message.progress_stage === 'reviewing' ? '답변의 근거를 다시 검토하고 있어요' : message.progress_stage === 'writing' ? '검토한 답변을 작성하고 있어요' : '답변을 준비하고 있어요'}</p>
          <AnalysisProgress label="답변 생성 진행 중" />
          {message.preview_content && <><RichText className="answer__text">{message.preview_content}</RichText><small>작성 중인 답변입니다. 완료되면 최종 답변과 근거가 표시됩니다.</small></>}
          <p className="answer__body">다른 화면으로 이동해도 유지됩니다.</p>
          {error && <div className="notice notice--error" role="alert">
            <p>답변 상태를 확인하지 못했어요. 연결되면 자동으로 다시 확인해요.</p>
            <p>{error}</p>
            {onReconnect && <Button tone="outline" onClick={onReconnect}>연결 다시 확인</Button>}
          </div>}
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
      <RichText className="answer__text">{message.content}</RichText>
      {message.citations.length > 0 && (
        <ul className="answer__citations">
          {message.citations.map((c) => (
            <li key={`${c.chapter_no}-${c.quote}`} className="citation">
              <p className="citation__label">
                근거 · {c.chapter_no}장{c.chapter_title && c.chapter_title !== `${c.chapter_no}장` ? ` ${c.chapter_title}` : ''}
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
