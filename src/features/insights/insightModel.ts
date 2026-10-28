import type { Character, Foreshadowing, Relationship } from '../../api/types'

export const VIEW_LIMIT = 6
export const chapterAt = (value: number, max: number) =>
  Number.isFinite(value) && value >= 1 ? Math.min(max, Math.floor(value)) : max
export function pageOf<T>(rows: T[], requested: number) {
  const count = Math.max(1, Math.ceil(rows.length / VIEW_LIMIT))
  const page = Number.isFinite(requested) ? Math.max(1, Math.min(count, Math.floor(requested))) : 1
  return { page, count, rows: rows.slice((page - 1) * VIEW_LIMIT, page * VIEW_LIMIT) }
}

export function snapshotAt(relationship: Relationship, chapter: number) {
  return (
    [...relationship.history]
      .filter((entry) => entry.chapter > 0 && entry.chapter <= chapter)
      .sort((a, b) => b.chapter - a.chapter)[0] ?? null
  )
}

export function relationshipView(
  people: Pick<Character, 'character_id' | 'name'>[],
  relationships: Relationship[],
  chapter: number,
  focus: string | null,
  requestedPage: number,
) {
  const byId = new Map(people.map((person) => [person.character_id, person]))
  const active = relationships.flatMap((relationship) => {
    const snapshot = snapshotAt(relationship, chapter)
    if (
      !snapshot ||
      relationship.source_character_id === relationship.target_character_id ||
      !byId.has(relationship.source_character_id) ||
      !byId.has(relationship.target_character_id)
    )
      return []
    return [{ relationship, snapshot }]
  })
  const degree = new Map<string, number>()
  for (const { relationship } of active) {
    for (const id of [relationship.source_character_id, relationship.target_character_id])
      degree.set(id, (degree.get(id) ?? 0) + 1)
  }
  const center =
    byId.get(focus ?? '') ??
    [...people].sort((a, b) => (degree.get(b.character_id) ?? 0) - (degree.get(a.character_id) ?? 0))[0] ??
    null
  const neighbors = center
    ? active
        .flatMap(({ relationship, snapshot }) => {
          const target =
            relationship.source_character_id === center.character_id
              ? relationship.target_character_id
              : relationship.target_character_id === center.character_id
                ? relationship.source_character_id
                : null
          return target ? [{ relationship, snapshot, person: byId.get(target)! }] : []
        })
        .sort((a, b) => a.person.name.localeCompare(b.person.name, 'ko'))
    : []
  return { center, neighbors, ...pageOf(neighbors, requestedPage) }
}

export function foreshadowStages(item: Foreshadowing) {
  const stages: Array<{ chapter: number; label: string; role: 'setup' | 'linked' | 'payoff' }> = []
  if (item.status !== 'orphaned' && item.setup_chapter > 0)
    stages.push({ chapter: item.setup_chapter, label: '심은 장면', role: 'setup' })
  for (const chapter of [...new Set(item.linked_chapters)].filter((no) => no > 0))
    stages.push({ chapter, label: '이어진 장면', role: 'linked' })
  if (item.payoff_chapter && item.payoff_chapter > 0)
    stages.push({ chapter: item.payoff_chapter, label: '회수한 장면', role: 'payoff' })
  return stages.sort((a, b) => a.chapter - b.chapter)
}

export function chapterPosition(chapter: number, max: number) {
  return max <= 1 ? 0 : Math.min(100, Math.max(0, ((chapter - 1) / (max - 1)) * 100))
}
