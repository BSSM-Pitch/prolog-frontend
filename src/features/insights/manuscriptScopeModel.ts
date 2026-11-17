import type { Foreshadowing } from '../../api/types.ts'

export function foreshadowingManuscript(item: Foreshadowing): string | null {
  const locations = item.chapter_locations ?? []
  const setup = locations.find((row) => row.role === 'setup')
  if (setup) return setup.manuscript_id
  const owners = [...new Set(locations.map((row) => row.manuscript_id))]
  return owners.length === 1 ? owners[0] : null
}

export function scopedForeshadowings(items: Foreshadowing[], manuscriptId: string, real: boolean) {
  return real ? items.filter((item) => foreshadowingManuscript(item) === manuscriptId) : items
}

export function eligibleChapters(chapters: number[], minimum = 1, maximum = Infinity, excluded: number[] = []) {
  return [...new Set(chapters)].filter((no) => no >= minimum && no <= maximum && !excluded.includes(no)).sort((a,b) => a-b)
}
