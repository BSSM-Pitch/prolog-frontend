import { DEMO_CHAPTERS } from '../../../api/mock/demo'
import type { QAMessage } from '../../../api/types'
import { AnswerCard } from '../../manuscripts/AnswerCard'
import { AppScreen, Caret, SelectBox } from './AppWindow'
import { typed, typingTime } from './clock'

// 원고에 물어보기(AskPage) — 질문을 보내면 실제 답변 카드(AnswerCard)가 근거 문장과 함께 돌아온다.
const QUESTION = '민아는 몇 살이었지?'
const quote = (no: number, word: string) => {
  const sentence = DEMO_CHAPTERS.find((c) => c.no === no)!.body.split('. ').find((s) => s.includes(word))!
  return sentence.endsWith('.') ? sentence : `${sentence}.`
}

const message = (status: QAMessage['status']): QAMessage => ({
  message_id: 'demo_answer',
  thread_id: 'demo_thread',
  role: 'assistant',
  status,
  content:
    status === 'completed'
      ? '2장에서는 열일곱, 21장 실종 서류에서는 열아홉으로 적혀 있어요.'
      : null,
  citations:
    status === 'completed'
      ? [
          { chapter_no: 2, chapter_title: '열쇠 모양의 흉터', quote: quote(2, '열일곱') },
          { chapter_no: 21, chapter_title: '민아의 나이', quote: quote(21, '열아홉') },
        ]
      : [],
  error: null,
  created_at: '',
})
const noop = () => {}

const TYPE_AT = 0.5
const SENT = TYPE_AT + typingTime(QUESTION, 9) + 0.5
const ANSWERED = SENT + 2.2
export const ASK_LENGTH = ANSWERED + 4.4

export function AskDemo({ t }: { t: number }) {
  const sent = t >= SENT
  const draft = sent ? '' : typed(QUESTION, t, TYPE_AT, 9)

  return (
    <AppScreen menu="manuscripts">
      <div className="ask">
        <header>
          <p className="page-crumb">AI 보조 도구 / 원고 질문</p>
          <h1 className="page-title">원고에 물어보기</h1>
        </header>
        <div className="ask__layout">
          <aside className="panel ask__threads">
            <h2 className="panel__title">최근 질문</h2>
            <button type="button" className="btn btn--outline btn--block">
              새 대화 시작
            </button>
            <ul className="thread-list">
              {sent && (
                <li className="lp-pop">
                  <button type="button" className="thread-item" aria-current="true">
                    <span className="thread-item__title">{QUESTION}</span>
                    <span className="thread-item__meta">원고 전체 · 방금</span>
                  </button>
                </li>
              )}
              <li>
                <button type="button" className="thread-item">
                  <span className="thread-item__title">22장에서 윤서는 규칙 17을 알고 있나요?</span>
                  <span className="thread-item__meta">선택한 문장 · 어제</span>
                </button>
              </li>
            </ul>
          </aside>
          <section className="panel ask__chat">
            <div className="ask__target">
              <span className="panel__label">대상 원고</span>
              <SelectBox value="붉은 문 너머 / 3차 원고" />
            </div>
            <div className="ask__messages">
              {!sent ? (
                <div className="ask__empty">
                  <p className="answer__title">원고에 대해 무엇이든 물어보세요</p>
                  <p className="answer__body">답변에는 근거가 된 장과 문장이 함께 붙어요. 질문해도 원고는 바뀌지 않아요.</p>
                </div>
              ) : (
                <>
                  <p className="bubble lp-pop">{QUESTION}</p>
                  <div className="lp-pop" key={t >= ANSWERED ? 'done' : 'wait'}>
                    <AnswerCard
                      message={message(t >= ANSWERED ? 'completed' : 'pending')}
                      error={null}
                      onRetry={noop}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="composer">
              <div className="field">
                <span className="field__label">질문</span>
                <div className="textbox composer__input">
                  <div className={`textbox__input${draft ? '' : ' lp-placeholder'}`}>
                    {draft || '22장에서 윤서는 규칙 17을 이미 알고 있나요?'}
                    {draft && <Caret />}
                  </div>
                </div>
              </div>
              <div className="composer__actions">
                <div className="segmented">
                  <button type="button" role="radio" aria-checked="true">
                    전체 원고
                  </button>
                  <button type="button" role="radio" aria-checked="false">
                    문장 선택
                  </button>
                </div>
                <button type="button" className={`btn btn--primary${t >= SENT - 0.4 && !sent ? ' lp-press' : ''}`}>
                  보내기
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppScreen>
  )
}
