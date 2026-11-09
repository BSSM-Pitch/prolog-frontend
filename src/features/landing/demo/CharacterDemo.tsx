import { Stepper } from '../../characters/shared'
import { AppScreen, Caret } from './AppWindow'
import { typed, typingTime } from './clock'

// 문장으로 인물 그리기(NewCharacterPage) — 묘사를 적으면 네 갈래 속성이 원문 근거와 함께 나온다.
const NAME = '윤서'
const DESCRIPTION =
  '윤서는 신중하지만 집요하고, 약속을 무엇보다 중요하게 여긴다. 재현의 선택에 영향을 받았으며 붉은 문 앞에서 불안을 느낀다.'
const EXTRACTED = [
  { title: '성격 태그 · 신중함, 집요함', evidence: '윤서는 신중하지만 집요하고' },
  { title: '핵심 가치 · 약속 중시', evidence: '약속을 무엇보다 중요하게 여긴다' },
  { title: '영향 관계 · 재현', evidence: '재현의 선택에 영향을 받았으며' },
  { title: '감정 키워드 · 불안', evidence: '붉은 문 앞에서 불안을 느낀다' },
]

const NAME_AT = 0.4
const DESC_AT = NAME_AT + typingTime(NAME, 6) + 0.3
const PRESS = DESC_AT + typingTime(DESCRIPTION, 24) + 0.4
const RESULT = PRESS + 1.6
const STAGGER = 0.35
export const CHARACTER_LENGTH = RESULT + EXTRACTED.length * STAGGER + 3.4

export function CharacterDemo({ t }: { t: number }) {
  const name = typed(NAME, t, NAME_AT, 6)
  const description = typed(DESCRIPTION, t, DESC_AT, 24)
  const extracting = t >= PRESS && t < RESULT

  return (
    <AppScreen menu="characters">
      <div className="nl-design">
        <header>
          <p className="page-crumb">등장인물 / 새 인물</p>
          <h1 className="page-title">문장으로 인물 그리기</h1>
          <p className="page-desc">떠오르는 모습을 적으면 인물 초안으로 정리해요.</p>
        </header>
        <Stepper current={t >= RESULT ? 2 : 1} />
        <div className="two-col">
          <div className="panel">
            <h2 className="panel__title">자연어 입력</h2>
            <div className="segmented segmented--wide">
              <button type="button" role="radio" aria-checked="true">
                새 인물
              </button>
              <button type="button" role="radio" aria-checked="false">
                기존 인물에 추가
              </button>
            </div>
            <div className="field">
              <span className="field__label">인물 이름</span>
              <div className="field__control">
                <div className={`field__input lp-input${name ? '' : ' lp-placeholder'}`}>
                  {name || '윤서'}
                  {t >= NAME_AT && t < DESC_AT && <Caret />}
                </div>
              </div>
            </div>
            <div className="field">
              <span className="field__label">인물 설명</span>
              <div className="textbox nl-textarea">
                <div className={`textbox__input${description ? '' : ' lp-placeholder'}`}>
                  {description || '떠오르는 모습을 문장으로 적어 보세요.'}
                  {t >= DESC_AT && t < PRESS && <Caret />}
                </div>
              </div>
            </div>
            <button
              type="button"
              className={`btn btn--primary btn--block${extracting ? ' btn--busy' : ''}`}
              aria-busy={extracting || undefined}
            >
              추출 미리보기
            </button>
          </div>
          <section className="panel">
            <h2 className="panel__title">{t >= RESULT ? '추출 미리보기 / 4개 카테고리' : '추출 미리보기'}</h2>
            {t < RESULT ? (
              <div className="state-block">
                {extracting && <span className="answer__spinner" aria-hidden="true" />}
                <p className="answer__title">
                  {extracting ? '문장에서 인물 속성을 나누고 있어요' : '문장을 입력하고 추출 미리보기를 눌러 보세요'}
                </p>
                <p className="answer__body">성격, 가치관, 영향 관계, 감정 키워드를 원문 근거와 함께 나눠 드려요.</p>
              </div>
            ) : (
              <>
                {EXTRACTED.map((item, i) =>
                  t >= RESULT + i * STAGGER ? (
                    <div key={item.title} className="extract-card lp-pop">
                      <p className="extract-card__title">{item.title}</p>
                      <p className="extract-card__evidence">근거 “{item.evidence}”</p>
                    </div>
                  ) : null,
                )}
                {t >= RESULT + EXTRACTED.length * STAGGER && (
                  <button type="button" className="btn btn--primary btn--block lp-pop">
                    인물 초안 다듬기
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </AppScreen>
  )
}
