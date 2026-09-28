import { request } from './client'
import type { Character, CharacterCategory, CharacterDraft, EditHistoryEntry, NLExtraction } from './types'

// NLCD · ASS 명세 — 인물

const p = (projectId: string) => `/projects/${projectId}`

export function listCharacters(token: string, projectId: string) {
  return request<Character[]>('GET', `${p(projectId)}/characters`, { accessToken: token })
}

/** (명세 미정의) 인물 삭제 — 관계가 남아 있으면 409 CHARACTER_HAS_DEPENDENT_RELATIONSHIPS */
export function deleteCharacter(token: string, projectId: string, characterId: string) {
  return request<null>('DELETE', `${p(projectId)}/characters/${characterId}`, { accessToken: token })
}

/** NLCD 4.1 자연어 입력 제출 */
export function createExtraction(token: string, projectId: string, input: { source_text: string; character_name?: string; target_character_id?: string | null }) {
  return request<NLExtraction>('POST', `${p(projectId)}/nl-extractions`, { body: input, accessToken: token })
}

/** NLCD 4.2 결과 폴링 */
export function getExtraction(token: string, projectId: string, extractionId: string) {
  return request<NLExtraction>('GET', `${p(projectId)}/nl-extractions/${extractionId}`, { accessToken: token })
}

export function retryExtraction(token: string, projectId: string, extractionId: string) {
  return request<NLExtraction>('POST', `${p(projectId)}/nl-extractions/${extractionId}/retry`, { accessToken: token })
}

/** NLCD 4.5 추출 결과를 ASS 초안으로 전달 */
export function forwardExtraction(token: string, projectId: string, extractionId: string) {
  return request<{ extraction_id: string; forwarded_draft_id: string }>('POST', `${p(projectId)}/nl-extractions/${extractionId}/forward`, { accessToken: token })
}

const d = (projectId: string, draftId: string) => `${p(projectId)}/character-drafts/${draftId}`

export function getDraft(token: string, projectId: string, draftId: string) {
  return request<CharacterDraft>('GET', d(projectId, draftId), { accessToken: token })
}

export function renameDraft(token: string, projectId: string, draftId: string, character_name: string) {
  return request<CharacterDraft>('PATCH', d(projectId, draftId), { body: { character_name }, accessToken: token })
}

export interface ItemInput {
  field?: CharacterCategory
  value?: string
  target?: string
  type?: string
  status?: string | null
}

export function addDraftItem(token: string, projectId: string, draftId: string, input: ItemInput) {
  return request<CharacterDraft['items'][number]>('POST', `${d(projectId, draftId)}/items`, { body: input, accessToken: token })
}

export function updateDraftItem(token: string, projectId: string, draftId: string, itemId: string, input: ItemInput) {
  return request<CharacterDraft['items'][number]>('PATCH', `${d(projectId, draftId)}/items/${itemId}`, { body: input, accessToken: token })
}

export function deleteDraftItem(token: string, projectId: string, draftId: string, itemId: string) {
  return request<null>('DELETE', `${d(projectId, draftId)}/items/${itemId}`, { accessToken: token })
}

export function getDraftHistory(token: string, projectId: string, draftId: string) {
  return request<EditHistoryEntry[]>('GET', `${d(projectId, draftId)}/edit-history`, { accessToken: token })
}

export function discardDraft(token: string, projectId: string, draftId: string) {
  return request<{ draft_id: string; status: string }>('POST', `${d(projectId, draftId)}/discard`, { accessToken: token })
}

/** ASS 4.9 확정 — 중복이면 409 후 resolution으로 다시 요청 */
export function confirmDraft(token: string, projectId: string, draftId: string, body: { resolution?: 'merge' | 'create_new'; merge_target_character_id?: string } = {}) {
  return request<Character>('POST', `${d(projectId, draftId)}/confirm`, { body, accessToken: token })
}
