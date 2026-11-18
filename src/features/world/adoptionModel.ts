export interface Adoption {
  index: number
  kind: string
  target_id: string
}
export function adoptionPath(projectId: string, manuscriptId: string, saved: Adoption) {
  const query = new URLSearchParams({
    manuscript: manuscriptId,
    [saved.kind === 'relationship' ? 'rel' : 'selected']: saved.target_id,
  })
  return `/projects/${projectId}/${saved.kind === 'relationship' ? 'relationships' : 'foreshadowings'}?${query}`
}
