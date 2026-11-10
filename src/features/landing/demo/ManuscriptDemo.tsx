import { DEMO_CHAPTERS } from '../../../api/mock/demo'
import { AppScreen, Caret, SelectBox } from './AppWindow'
import { typed, typingTime } from './clock'

// 원고 편집기(EditorPage) — 22장을 쓰면 자동 저장되고, 설정 검사가 규칙 17과 어긋난 문장을 짚는다.
const BODY = DEMO_CHAPTERS.find((c) => c.no === 22)!.body
const ISSUE = '윤서는 규칙 17을 알면서도 위원회 문을 열었다.'
const RULE = DEMO_CHAPTERS.find((c) => c.no === 17)!.body.split('. ')[1]

const TYPE_AT = 0.4
const TYPED = TYPE_AT + typingTime(BODY, 26)
const SAVED = TYPED + 0.9
const CHECK = SAVED + 0.7
const FOUND = CHECK + 1.3
const CARD = FOUND + 0.5
export const MANUSCRIPT_LENGTH = CARD + 3.6

export function ManuscriptDemo({ t }: { t: number }) {
  const text = typed(BODY, t, TYPE_AT, 26)
  const writing = t < TYPED
  const found = t >= FOUND
  const save = t < TYPE_AT ? '자동 저장됨 · 3시간 전' : t < SAVED ? '저장 중…' : '자동 저장됨 · 방금'

  return (
    <AppScreen menu="manuscripts">
      <div className="editor">
        <header className="editor__page-head">
          <div>
            <p className="page-crumb">붉은 문 너머 / 원고</p>
            <h1 className="page-title">3차 원고</h1>
          </div>
          <button type="button" className="btn btn--outline">
            작품 살펴보기
          </button>
        </header>
        <div className="editor__layout">
          <section className="panel editor__paper">
            <div className="editor__head">
              <div className="editor__head-title">
                <SelectBox value="22장 · 기록위원회 진입" className="editor__chapter" />
                <button type="button" className="btn btn--soft">
                  + 장 추가
                </button>
              </div>
              <div className="editor__badges">
                <span className="page-crumb">{save}</span>
              </div>
            </div>
            <div className="manuscript-review">
              <div className="manuscript-review__tools">
                {found && (
                  <button type="button" className="manuscript-review__count">
                    검토 1곳
                  </button>
                )}
                <button type="button" className="text-link" disabled={t >= CHECK && !found}>
                  {t >= CHECK && !found ? '검사 중…' : '설정 검사'}
                </button>
              </div>
              <div className="textbox editor__text manuscript-review__input">
                <div className="manuscript-review__surface">
                  <div className="manuscript-review__mirror" aria-hidden="true">
                    <div>
                      {found ? (
                        <>
                          <span className="manuscript-review__underline">{ISSUE}</span>
                          {BODY.slice(ISSUE.length)}
                        </>
                      ) : (
                        text
                      )}
                    </div>
                  </div>
                  <div className="textbox__input manuscript-review__textarea">
                    {text}
                    {writing && <Caret />}
                  </div>
                </div>
              </div>
              {t >= CARD && (
                <div className="manuscript-review__card lp-pop" style={{ left: 40, top: 236 }}>
                  <div className="manuscript-review__card-head">
                    <span>설정 확인</span>
                    <button type="button">×</button>
                  </div>
                  <h2>규칙 17과 어긋나요</h2>
                  <blockquote>17장 · {RULE}.</blockquote>
                  <p className="manuscript-review__advice">
                    17장 규칙대로라면 문을 연 윤서는 기록에서 지워져야 해요. 재현이 윤서를 알아보는 장면과 함께 살펴 주세요.
                  </p>
                  <div className="manuscript-review__actions">
                    <button type="button" className="text-link">
                      자세히 검토
                    </button>
                    <button type="button" className="text-link">
                      무시
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="editor__foot">
              <span className="panel__label">{[...text].length}자</span>
              <span className="text-link">편집 이력</span>
            </div>
          </section>
          <aside className="editor__side">
            <div className="panel">
              <h2 className="panel__title">원고에 물어보기</h2>
              <p className="panel__label">문장을 선택하면 그 부분을 중심으로 살펴봐요.</p>
              <div className="field">
                <span className="field__label">질문</span>
                <div className="textbox editor__question">
                  <div className="textbox__input lp-placeholder">앞선 설정과 다른 부분이 있어?</div>
                </div>
              </div>
              <button type="button" className="btn btn--primary btn--block">
                질문 보내기
              </button>
            </div>
            <span className="text-link">이전 대화 보기</span>
          </aside>
        </div>
      </div>
    </AppScreen>
  )
}
