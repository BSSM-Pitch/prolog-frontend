import { ApiError, request, requestAll } from './client'
import { IS_REAL } from './config'
import { listChapters } from './manuscripts'
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

export function listRelationships(token: string, projectId: string, manuscriptId?: string) {
  if (IS_REAL)
    return requestAll<Relationship>(base(projectId), {
      accessToken: token,
      query: manuscriptId ? { manuscript_id: manuscriptId } : undefined,
    })
  return request<Relationship[]>('GET', base(projectId), { accessToken: token })
}

async function chapterId(token: string, projectId: string, manuscriptId: string | undefined, chapter: number) {
  if (!manuscriptId)
    throw new ApiError(400, { code: 'INVALID_INPUT', message: '기록할 원고를 골라 주세요.', details: {} })
  const chapters = await listChapters(token, projectId, manuscriptId)
  const found = chapters.find((row) => row.chapter_no === chapter)
  if (!found)
    throw new ApiError(400, {
      code: 'INVALID_INPUT',
      message: `${chapter}장이 없어요. 원고에서 장을 먼저 만들어 주세요.`,
      details: {},
    })
  return found.chapter_id
}

async function backendEntry(token: string, projectId: string, entry: EntryInput, manuscriptId?: string) {
  return {
    chapter_id: await chapterId(token, projectId, manuscriptId, entry.chapter),
    state: entry.state,
    trust: entry.trust,
    event_title: entry.event_title ?? null,
  }
}

export async function createRelationship(
  token: string,
  projectId: string,
  input: { source_character_id: string; target_character_id: string; initial_history: EntryInput },
  manuscriptId?: string,
) {
  if (IS_REAL)
    return request<Relationship>('POST', base(projectId), {
      body: { ...input, initial_history: await backendEntry(token, projectId, input.initial_history, manuscriptId) },
      accessToken: token,
    })
  return request<Relationship>('POST', base(projectId), { body: input, accessToken: token })
}

export function deleteRelationship(token: string, projectId: string, relationshipId: string) {
  return request<null>('DELETE', `${base(projectId)}/${relationshipId}`, { accessToken: token })
}

/** 4.6 특정 장 상태 기록 — 같은 장에 기록이 있으면 409 DUPLICATE_CHAPTER_RECORD, overwrite로 다시 요청 */
export async function recordState(
  token: string,
  projectId: string,
  relationshipId: string,
  entry: EntryInput,
  overwrite = false,
  manuscriptId?: string,
) {
  if (IS_REAL) {
    await request('POST', `${base(projectId)}/${relationshipId}/history`, {
      body: await backendEntry(token, projectId, entry, manuscriptId),
      query: overwrite ? { overwrite: 'true' } : undefined,
      accessToken: token,
    })
    return request<Relationship>('GET', `${base(projectId)}/${relationshipId}`, {
      accessToken: token,
      query: { manuscript_id: manuscriptId! },
    })
  }
  return request<Relationship>('POST', `${base(projectId)}/${relationshipId}/history`, {
    body: entry,
    query: overwrite ? { overwrite: 'true' } : undefined,
    accessToken: token,
  })
}

export async function deleteRecord(
  token: string,
  projectId: string,
  relationshipId: string,
  chapter: number,
  manuscriptId?: string,
) {
  const ref = IS_REAL ? await chapterId(token, projectId, manuscriptId, chapter) : chapter
  return request<null>('DELETE', `${base(projectId)}/${relationshipId}/history/${ref}`, { accessToken: token })
}

export function getMindmap(
  token: string,
  projectId: string,
  chapter: number,
  characterId?: string,
  manuscriptId?: string,
) {
  const query: Record<string, string> = { chapter: String(chapter) }
  if (manuscriptId) query.manuscript_id = manuscriptId
  if (characterId) query.character_id = characterId
  return request<MindmapGraph>('GET', `/projects/${projectId}/relationship-mindmap`, { query, accessToken: token })
}
