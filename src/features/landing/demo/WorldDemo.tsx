import { AppScreen } from './AppWindow'

// 설정 규칙(RulesPage) — 원고에서 규칙 후보를 뽑고, 하나를 열면 원문 근거가 붙어 있다.
// 문구는 목업 서버가 데모 원고에서 실제로 뽑아내는 후보와 같다.
const RULES = [
  { code: 'R01', chapter: 6, text: '재현은 열람 신청서를 내밀며 위원 두 사람의 서명이 필요하다고 했다' },
  { code: 'R02', chapter: 10, text: '문을 열려는 사람은 먼저 기록되어야 한다고 적혀 있었다' },
  { code: 'R03', chapter: 17, text: '붉은 문을 연 사람은 그 순간부터 기록에서 지워진다' },
  { code: 'R04', chapter: 20, text: '지하 기록실에는 금속을 가지고 들어갈 수 없었다' },
]
const PICK = 2

const PRESS = 1.2
const FOUND = PRESS + 1.6
const STAGGER = 0.3
const OPEN = FOUND + RULES.length * STAGGER + 0.9
export const WORLD_LENGTH = OPEN + 4.2

export function WorldDemo({ t }: { t: number }) {
  const found = t >= FOUND
  const running = t >= PRESS && !found
  const open = t >= OPEN
  const shown = found ? RULES.filter((_, i) => t >= FOUND + i * STAGGER) : []
  const rule = RULES[PICK]

  return (
    <AppScreen menu="world">
      <div className="world">
        <header>
          <p className="page-crumb">원고 기반 규칙 / 확정 0 · 검토 대기 {shown.length}</p>
          <h1 className="page-title">설정 규칙</h1>
        </header>
        <div className="two-col two-col--list">
          <section className="panel">
            <h2 className="panel__title">규칙 {shown.length}개</h2>
            <div className="chips">
              <span className="badge badge--filled">확정 0</span>
              <span className="badge badge--waiting">검토 대기 {shown.length}</span>
            </div>
            {!found && (
              <div className="state-block">
                {running && <span className="answer__spinner" aria-hidden="true" />}
                <p className="answer__title">{running ? '원고에서 규칙을 찾고 있어요' : '찾은 규칙이 없어요'}</p>
                <p className="answer__body">원고에서 규칙을 추출하거나 필요한 규칙을 직접 추가해 보세요.</p>
              </div>
            )}
            <ul className="char-list">
              {shown.map((r, i) => (
                <li key={r.code} className="lp-pop">
                  <button type="button" className="char-item" aria-current={open && i === PICK ? 'true' : undefined}>
                    <span className="char-item__name">
                      <span className="rule-tag">후보</span>
                      {r.code} · {r.chapter}장 규칙
                    </span>
                    <span className="char-item__meta">{r.text} / AI 추출 · {r.chapter}장 근거</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="actions-row">
              <button type="button" className="btn btn--outline">
                + 규칙 직접 추가
              </button>
              <button
                type="button"
                className={`btn btn--secondary${running ? ' btn--busy' : ''}`}
                aria-busy={running || undefined}
              >
                원고에서 다시 추출
              </button>
            </div>
          </section>
          {open && (
            <section className="panel lp-pop">
              <p className="panel__label">AI 추출 후보 / {rule.code}</p>
              <div className="chips">
                <span className="badge badge--done">AI 추출</span>
                <span className="badge badge--waiting">검토 대기</span>
              </div>
              <h2 className="page-title">{rule.text}</h2>
              <div>
                <p className="panel__label">위반 판정 키워드</p>
                <p className="panel__label">아직 없어요. 키워드를 넣어야 설정 충돌 검토에서 이 규칙으로 위반 여부를 판정해요.</p>
              </div>
              <div className="evidence-box">
                원문 근거 · {rule.chapter}장 “{rule.text}.” <span className="text-link">{rule.chapter}장 원문 보기</span>
              </div>
              <div className="actions-row">
                <button type="button" className="btn btn--outline">
                  내용 수정
                </button>
                <button type="button" className="btn btn--outline">
                  무시
                </button>
                <button type="button" className="btn btn--primary">
                  규칙으로 확정
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </AppScreen>
  )
}
