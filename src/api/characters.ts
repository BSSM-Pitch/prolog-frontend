import { influenceText, isBackendId, toDraft, toDraftItem, type BackendCharacter, type BackendDraft, type BackendDraftItem } from './backendShapes'
import { request, requestLenient, requestMock } from './client'
import { AI_REAL, IS_REAL } from './config'
import { markDraftConfirmed } from './mock/bridge'
import type { Character, CharacterCategory, CharacterDraft, EditHistoryEntry, NLExtraction } from './types'

// NLCD · ASS 명세 — 인물
//
// real 모드: 확정 인물과 백엔드 초안(UUID)은 백엔드가 받는다. AI 추출(NLCD)도 백엔드가 하고 초안을 백엔드에 만든다.
// VITE_AI_MODE=mock이면 추출은 목업이 하고, 그 초안(draft_301 등)은 확정하는 순간 백엔드에 옮겨 쓴다.

const p = (projectId: string) => `/projects/${projectId}`
const realDraft = (draftId: string) => IS_REAL && isBackendId(draftId)

/**
 * 인물 목록. real 모드는 백엔드 인물을 목업에 옮긴 뒤 목업이 돌려준다 —
 * 역할·상태 표시와 관계 수·주요 변화는 관계(RCV, 목업)에서 오기 때문이다.
 */
export function listCharacters(token: string, projectId: string) {
  if (IS_REAL) return requestMock<Character[]>('GET', `${p(projectId)}/characters`, { accessToken: token })
  return request<Character[]>('GET', `${p(projectId)}/characters`, { accessToken: token })
}

/** (명세 미정의) 인물 삭제 — 관계가 남아 있으면 409 CHARACTER_HAS_DEPENDENT_RELATIONSHIPS */
export async function deleteCharacter(token: string, projectId: string, characterId: string) {
  // 관계는 목업에만 있다. 목업이 먼저 막고(409), 통과하면 백엔드에서 지운다
  if (IS_REAL) await requestMock<null>('DELETE', `${p(projectId)}/characters/${characterId}`, { accessToken: token })
  return request<null>('DELETE', `${p(projectId)}/characters/${characterId}`, { accessToken: token })
}

/** 백엔드 NLCD 추출 — 인물 이름 필드가 name이다. 실패는 200 + data(status=failed) + error */
type BackendExtraction = Omit<NLExtraction, 'character_name'> & { name: string | null }
const toExtraction = ({ name, ...e }: BackendExtraction): NLExtraction => ({ ...e, character_name: name })
const realExtraction = async (method: string, path: string, options: Parameters<typeof request>[2]) => toExtraction((await requestLenient<BackendExtraction>(method, path, options)).data)

/** NLCD 4.1 자연어 입력 제출 */
export function createExtraction(token: string, projectId: string, input: { source_text: string; character_name?: string; target_character_id?: string | null }) {
  if (AI_REAL) {
    const { character_name, ...rest } = input
    return realExtraction('POST', `${p(projectId)}/nl-extractions`, { body: { ...rest, name: character_name || undefined }, accessToken: token })
  }
  return request<NLExtraction>('POST', `${p(projectId)}/nl-extractions`, { body: input, accessToken: token })
}

/** NLCD 4.2 결과 폴링 */
export function getExtraction(token: string, projectId: string, extractionId: string) {
  if (AI_REAL) return realExtraction('GET', `${p(projectId)}/nl-extractions/${extractionId}`, { accessToken: token })
  return request<NLExtraction>('GET', `${p(projectId)}/nl-extractions/${extractionId}`, { accessToken: token })
}

export function retryExtraction(token: string, projectId: string, extractionId: string) {
  if (AI_REAL) return realExtraction('POST', `${p(projectId)}/nl-extractions/${extractionId}/retry`, { accessToken: token })
  return request<NLExtraction>('POST', `${p(projectId)}/nl-extractions/${extractionId}/retry`, { accessToken: token })
}

/** NLCD 4.5 추출 결과를 ASS 초안으로 전달 (백엔드면 백엔드 초안 UUID가 온다) */
export function forwardExtraction(token: string, projectId: string, extractionId: string) {
  return request<{ extraction_id: string; forwarded_draft_id: string }>('POST', `${p(projectId)}/nl-extractions/${extractionId}/forward`, { accessToken: token })
}

const d = (projectId: string, draftId: string) => `${p(projectId)}/character-drafts/${draftId}`

export async function getDraft(token: string, projectId: string, draftId: string) {
  if (realDraft(draftId)) return toDraft(await request<BackendDraft>('GET', d(projectId, draftId), { accessToken: token }))
  return request<CharacterDraft>('GET', d(projectId, draftId), { accessToken: token })
}

export async function renameDraft(token: string, projectId: string, draftId: string, character_name: string) {
  if (realDraft(draftId)) return toDraft(await request<BackendDraft>('PATCH', d(projectId, draftId), { body: { character_name }, accessToken: token }))
  return request<CharacterDraft>('PATCH', d(projectId, draftId), { body: { character_name }, accessToken: token })
}

export interface ItemInput {
  field?: CharacterCategory
  value?: string
  target?: string
  type?: string
  status?: string | null
}

/** 백엔드 항목은 field·value뿐이다. 영향 관계의 대상·유형·상태는 value 한 줄로 합친다 */
const backendItem = (input: ItemInput) => ({ field: input.field, value: input.field === 'influence_relations' || input.target !== undefined ? influenceText(input) : input.value })

export async function addDraftItem(token: string, projectId: string, draftId: string, input: ItemInput) {
  if (realDraft(draftId)) return toDraftItem(await request<BackendDraftItem>('POST', `${d(projectId, draftId)}/items`, { body: backendItem(input), accessToken: token }))
  return request<CharacterDraft['items'][number]>('POST', `${d(projectId, draftId)}/items`, { body: input, accessToken: token })
}

export async function updateDraftItem(token: string, projectId: string, draftId: string, itemId: string, input: ItemInput) {
  if (realDraft(draftId)) return toDraftItem(await request<BackendDraftItem>('PATCH', `${d(projectId, draftId)}/items/${itemId}`, { body: backendItem(input), accessToken: token }))
  return request<CharacterDraft['items'][number]>('PATCH', `${d(projectId, draftId)}/items/${itemId}`, { body: input, accessToken: token })
}

export function deleteDraftItem(token: string, projectId: string, draftId: string, itemId: string) {
  return request<null>('DELETE', `${d(projectId, draftId)}/items/${itemId}`, { accessToken: token })
}

const FIELD_LABEL: Record<string, string> = { personality_tags: '성격 태그', core_values: '핵심 가치', influence_relations: '영향 관계', emotion_keywords: '감정 키워드', character_name: '인물 이름', name: '인물 이름' }

export async function getDraftHistory(token: string, projectId: string, draftId: string) {
  if (!realDraft(draftId)) return request<EditHistoryEntry[]>('GET', `${d(projectId, draftId)}/edit-history`, { accessToken: token })
  // 백엔드는 필드를 키로, 바뀐 값을 before/after로 준다 — 목업처럼 "카테고리 이름"과 "이전 → 이후"로 보여 준다
  const rows = await request<Array<{ action: EditHistoryEntry['action']; field: string; value: string | null; before_value: string | null; after_value: string | null; at: string }>>('GET', `${d(projectId, draftId)}/edit-history`, { accessToken: token })
  return rows.map((h): EditHistoryEntry => ({
    action: h.action,
    field: FIELD_LABEL[h.field] ?? h.field,
    value: h.action === 'modified' ? `${h.before_value ?? '(없음)'} → ${h.after_value ?? ''}` : (h.value ?? h.after_value ?? h.before_value ?? ''),
    at: h.at,
  }))
}

export function discardDraft(token: string, projectId: string, draftId: string) {
  return request<{ draft_id: string; status: string }>('POST', `${d(projectId, draftId)}/discard`, { accessToken: token })
}

type ConfirmBody = { resolution?: 'merge' | 'create_new'; merge_target_character_id?: string }

/** ASS 4.9 확정 — 중복이면 409 후 resolution으로 다시 요청 */
export async function confirmDraft(token: string, projectId: string, draftId: string, body: ConfirmBody = {}): Promise<Pick<Character, 'character_id' | 'name'>> {
  if (!IS_REAL) return request<Character>('POST', `${d(projectId, draftId)}/confirm`, { body, accessToken: token })
  if (isBackendId(draftId)) return request<BackendCharacter>('POST', `${d(projectId, draftId)}/confirm`, { body, accessToken: token })
  return publishDraft(token, projectId, draftId, body)
}

/** 목업 초안 → 백엔드 초안. 중복 확인(409) 뒤 다시 확정할 때 같은 백엔드 초안을 쓴다 */
const published = new Map<string, string>()

/**
 * AI 초안(목업)을 확정한다: 백엔드에 빈 초안을 만들고 항목을 옮긴 뒤 확정한다.
 * 백엔드 API로 넣은 항목은 origin이 user_added가 되고 원문 근거(evidence)를 받지 않는다 — 백엔드 팀과 맞출 것.
 */
async function publishDraft(token: string, projectId: string, draftId: string, body: ConfirmBody) {
  const draft = await requestMock<CharacterDraft>('GET', d(projectId, draftId), { accessToken: token })
  let realId = published.get(draftId)
  if (realId) {
    await request<BackendDraft>('PATCH', `${p(projectId)}/character-drafts/${realId}`, { body: { character_name: draft.character_name ?? '' }, accessToken: token })
  } else {
    const created = await request<BackendDraft>('POST', `${p(projectId)}/character-drafts`, { body: { character_name: draft.character_name }, accessToken: token })
    realId = created.draft_id
    for (const item of draft.items) {
      await request<BackendDraftItem>('POST', `${p(projectId)}/character-drafts/${realId}/items`, { body: backendItem(item), accessToken: token })
    }
    published.set(draftId, realId)
  }
  // 기존 인물에 더하는 초안(NLCD target_character_id)은 그 인물에 합친다
  const confirmBody = !body.resolution && draft.target_character_id ? { resolution: 'merge' as const, merge_target_character_id: draft.target_character_id } : body
  const character = await request<BackendCharacter>('POST', `${p(projectId)}/character-drafts/${realId}/confirm`, { body: confirmBody, accessToken: token })
  published.delete(draftId)
  markDraftConfirmed(draftId, character.character_id)
  return character
}
