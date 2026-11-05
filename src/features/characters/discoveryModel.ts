import type { DiscoveredCharacter } from '../../api/characterMemory'

/** Overlapping manuscript chunks can discover the same person more than once. */
export function uniqueCandidates(candidates: DiscoveredCharacter[]) {
  return [...new Map(candidates.map((candidate) => [candidate.name.toLowerCase(), candidate])).values()]
}

export function discoverySummary(candidates: DiscoveredCharacter[]) {
  const unique = uniqueCandidates(candidates)
  const added = new Set(unique.filter((c) => c.status === 'added' && c.character_id).map((c) => c.character_id))
  return {
    added: added.size,
    existing: new Set(
      unique
        .filter((c) => c.status === 'existing' && c.character_id && !added.has(c.character_id))
        .map((c) => c.character_id),
    ).size,
    review: unique.filter((c) => c.status === 'needs_review'),
  }
}
