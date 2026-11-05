import type { CharacterDetails, DetailPattern, DetailRecord } from '../../api/characterMemory'

export function patternRecords(patterns: DetailPattern[], records: DetailRecord[]) {
  const byId = new Map(records.map((r) => [r.observation_id, r]))
  const resolve = (ids: string[]) => ids.map((id) => byId.get(id)).filter((r): r is DetailRecord => Boolean(r))
  return patterns.map((p) => ({
    ...p,
    support: resolve(p.supporting_observation_ids),
    counterexamples: resolve(p.counterexample_observation_ids),
  }))
}

export type DetailCategory = 'all' | 'speech' | 'action' | 'inner_thought' | 'patterns' | 'uncertain'
export const kindLabel = { speech: '발화', action: '행동', inner_thought: '내면', narration: '서술' }
export const roleLabel = {
  trigger: '계기',
  awareness: '자각',
  desire: '욕구',
  involuntary_reaction: '비의도적 반응',
  choice: '선택',
  other: '',
}
export const presentationLabel = {
  depicted: '묘사된 장면',
  character_claim: '인물의 주장',
  narrator_claim: '서술자의 설명',
  thought: '생각',
}
export function visibleRecords(
  data: CharacterDetails,
  category: DetailCategory,
  query: string,
  ids: string[] | null,
): DetailRecord[] {
  const needle = query.trim().toLocaleLowerCase()
  const rows = category === 'uncertain' ? data.uncertain_observations : data.observations
  return rows.filter(
    (r) =>
      (category === 'all' || category === 'uncertain' || r.kind === category) &&
      (!ids || ids.includes(r.observation_id)) &&
      (!needle ||
        [r.summary, r.context, r.evidence.quote, ...r.interlocutors].join(' ').toLocaleLowerCase().includes(needle)),
  )
}
export function periodLabel(orders: number[]) {
  return orders.length ? `${orders[0]}–${orders[orders.length - 1]} 구간` : '이전 구간 없음'
}
