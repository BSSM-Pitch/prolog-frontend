import type { CharacterCategory } from '../../api/types'

export const CATEGORIES: Array<{ field: CharacterCategory; label: string }> = [
  { field: 'personality_tags', label: '성격 태그' },
  { field: 'core_values', label: '핵심 가치' },
  { field: 'influence_relations', label: '영향 관계' },
  { field: 'emotion_keywords', label: '감정 키워드' },
]

const STEPS = ['자연어 입력', '추출 미리보기', '초안 검토', '확정']

/** 인물 설계 진행 단계 (Figma 1266:3400 상단) */
export function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="stepper" aria-label="인물 설계 단계">
      {STEPS.map((label, i) => {
        const n = i + 1
        const state = n < current ? 'done' : n === current ? 'current' : 'todo'
        return (
          <li key={label} className={`stepper__step stepper__step--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="stepper__dot" aria-hidden="true">
              {state === 'done' ? '✓' : n}
            </span>
            {label}
          </li>
        )
      })}
    </ol>
  )
}
