/**
 * Features 카드 안의 제품 UI 조각 (기획서 6장 핵심 기능 기준).
 * active 일 때만 연출(data-on)이 재생되고, 카드가 벗어나면 초기 상태로 돌아간다.
 */
import type { CSSProperties } from 'react'

type Props = { active: boolean }

const idx = (i: number) => ({ '--i': i }) as CSSProperties

/** 1. 자연어 입력 → 성격 태그로 자동 구조화 */
const TRAITS = ['책임감 강함', '자신감 부족', '폭력 회피', '스승 에단의 영향']

export function Character({ active }: Props) {
  return (
    <div className="fv fv-char" data-on={active}>
      <div className="fv-input">
        <span className="fv-type">
          아린은 책임감이 강하지만 자신감이 부족한 왕국의 기록관이다. 스승 에단의 영향을 크게 받았으며
          폭력을 싫어한다.
        </span>
      </div>
      <div className="fv-tags">
        {TRAITS.map((t, i) => (
          <span key={t} style={idx(i)}>
            {t}
            <i aria-hidden="true">×</i>
          </span>
        ))}
        <span className="fv-tags__add" style={idx(TRAITS.length)}>
          + 추가
        </span>
      </div>
    </div>
  )
}

/** 2. 기존 설정 vs 새 사건 → 경고 대신 조언 */
export function Conflict({ active }: Props) {
  return (
    <div className="fv fv-conflict" data-on={active}>
      <div className="fv-row">
        <p className="fv-cap">아린 · 기존 설정</p>
        <div className="fv-chips">
          <span>폭력을 싫어함</span>
          <span>책임감을 중시함</span>
        </div>
      </div>
      <div className="fv-row fv-event">
        <p className="fv-cap">12화 · 새 사건</p>
        <p>아린이 도적을 잔혹하게 제압한다.</p>
      </div>
      <div className="fv-advice">
        <span className="fv-spark">✦</span>
        <p>
          현재 설정과 비교하면 과도하게 공격적인 행동처럼 보여요. 분노 끝에 멈추는 방향도 고려해 보세요.
        </p>
      </div>
    </div>
  )
}

/** 3. 챕터에 따라 변하는 관계 */
const STAGES = [
  { ch: 'Ch. 1', state: '우호' },
  { ch: 'Ch. 20', state: '긴장' },
  { ch: 'Ch. 35', state: '갈등' },
]

export function Relation({ active }: Props) {
  return (
    <div className="fv fv-rel" data-on={active}>
      <div className="fv-pair">
        <span className="fv-who fv-who--a">아</span>
        <span className="fv-pair__line" />
        <span className="fv-who fv-who--b">에</span>
      </div>
      <p className="fv-pair__names">
        <span>아린</span>
        <span>에단</span>
      </p>
      <ol className="fv-stages">
        {STAGES.map((s, i) => (
          <li key={s.ch} style={idx(i)} data-state={s.state}>
            <i />
            <small>{s.ch}</small>
            <strong>{s.state}</strong>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** 4. 복선 설치 · 회수 여부 */
export function Foreshadow({ active }: Props) {
  return (
    <div className="fv fv-fore" data-on={active}>
      <svg viewBox="0 0 300 150" aria-hidden="true">
        {/* 챕터 레일 */}
        <line className="rail" x1="10" y1="118" x2="290" y2="118" />
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} className="tick" x1={10 + i * 28} y1="114" x2={10 + i * 28} y2="122" />
        ))}
        {/* 회수된 복선: Ch.3 → Ch.28 */}
        <path className="arc arc--done" d="M31 118 C 60 20, 190 20, 206 118" pathLength={1} />
        <circle className="pin" cx="31" cy="118" r="5" />
        <circle className="pin pin--done" cx="206" cy="118" r="5" />
        {/* 미회수 복선: Ch.12 → ? */}
        <path className="arc arc--open" d="M94 118 C 130 60, 220 50, 262 76" pathLength={1} />
        <circle className="pin" cx="94" cy="118" r="5" />
        <text x="10" y="142">Ch.1</text>
        <text x="290" y="142" textAnchor="end">
          Ch.40
        </text>
      </svg>
      <ul className="fv-legend">
        <li>
          <b className="ok">✓</b> 은빛 열쇠 <small>Ch.3 → Ch.28 회수</small>
        </li>
        <li>
          <b className="wait">…</b> 봉인된 편지 <small>Ch.12 설치 · 미회수</small>
        </li>
      </ul>
    </div>
  )
}

/** 5. 팀 공동 편집 · 피드백 */
export function Collab({ active }: Props) {
  return (
    <div className="fv fv-collab" data-on={active}>
      <div className="fv-doc">
        <p className="fv-doc__title">잿빛 왕국 — 12화 초고</p>
        <span className="fv-l" style={{ width: '94%' }} />
        <span className="fv-l" style={{ width: '82%' }} />
        <span className="fv-l fv-l--sel" style={{ width: '58%' }} />
        <span className="fv-l" style={{ width: '88%' }} />
        <span className="fv-l" style={{ width: '46%' }} />

        <span className="fv-cursor fv-cursor--a">
          <i />
          <em>서연</em>
        </span>
        <span className="fv-cursor fv-cursor--b">
          <i />
          <em>도윤</em>
        </span>
        <div className="fv-comment">
          <span className="fv-who fv-who--b">도</span>
          <p>이 장면, 아린 설정이랑 맞을까요?</p>
        </div>
      </div>
    </div>
  )
}
