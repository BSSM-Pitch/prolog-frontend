import type { NarrativeTrack } from '../../api/types.ts'
export function filterTracks(
  tracks: NarrativeTrack[],
  filters: { query: string; kind: string; focus: string; status: string; chapter: string },
) {
  const query = filters.query.trim().toLocaleLowerCase()
  return tracks
    .map((track, index) => ({ track, index }))
    .filter(
      ({ track }) =>
        (!filters.kind || track.kind === filters.kind) &&
        (!filters.focus || (track.focus ?? 'general') === filters.focus) &&
        (!filters.status || track.status === filters.status) &&
        (!filters.chapter || track.evidence.some((e) => String(e.chapter_no) === filters.chapter)) &&
        (!query ||
          [track.title, track.explanation, ...track.evidence.map((e) => e.quote)]
            .join(' ')
            .toLocaleLowerCase()
            .includes(query)),
    )
}
export function pageItems<T>(items: T[], requested: number, size = 8) {
  const pages = Math.max(1, Math.ceil(items.length / size))
  const page = Math.max(1, Math.min(pages, Number.isFinite(requested) ? Math.floor(requested) : 1))
  return { items: items.slice((page - 1) * size, page * size), page, pages }
}
