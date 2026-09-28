import { request } from './client'
import type { MindmapGraph, Relationship } from './types'

// RCV 명세 — 관계 변화

const base = (projectId: string) => `/projects/${projectId}/relationships`

export interface EntryInput {
  chapter: number
  state: string
  trust: number | null
  event_title?: string
}

export const RELATION_STATES = ['신뢰', '우호', '중립', '긴장', '갈등', '적대'] as const

export function listRelationships(token: string, projectId: string) {
  return request<Relationship[]>('GET', base(projectId), { accessToken: token })
}

export function createRelationship(token: string, projectId: string, input: { source_character_id: string; target_character_id: string; initial_history: EntryInput }) {
  return request<Relationship>('POST', base(projectId), { body: input, accessToken: token })
}

export function deleteRelationship(token: string, projectId: string, relationshipId: string) {
  return request<null>('DELETE', `${base(projectId)}/${relationshipId}`, { accessToken: token })
}

/** 4.6 특정 장 상태 기록 — 같은 장에 기록이 있으면 409 DUPLICATE_CHAPTER_RECORD, overwrite로 다시 요청 */
export function recordState(token: string, projectId: string, relationshipId: string, entry: EntryInput, overwrite = false) {
  return request<Relationship>('POST', `${base(projectId)}/${relationshipId}/history`, {
    body: entry,
    query: overwrite ? { overwrite: 'true' } : undefined,
    accessToken: token,
  })
}

export function deleteRecord(token: string, projectId: string, relationshipId: string, chapter: number) {
  return request<null>('DELETE', `${base(projectId)}/${relationshipId}/history/${chapter}`, { accessToken: token })
}

export function getMindmap(token: string, projectId: string, chapter: number, characterId?: string) {
  const query: Record<string, string> = { chapter: String(chapter) }
  if (characterId) query.character_id = characterId
  return request<MindmapGraph>('GET', `/projects/${projectId}/relationship-mindmap`, { query, accessToken: token })
}
