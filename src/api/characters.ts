import {
  influenceText,
  isBackendId,
  toDraft,
  toDraftItem,
  type BackendCharacter,
  type BackendChapter,
  type BackendManuscript,
  type BackendDraft,
  type BackendDraftItem,
} from './backendShapes'
import { request, requestLenient, requestAll } from './client'
import { IS_REAL } from './config'
import { listRelationships } from './relationships'
import type { Character, CharacterCategory, CharacterDraft, EditHistoryEntry, NLExtraction } from './types'

// real 모드에서는 인물과 관계 모두 서버 데이터를 읽는다.
const p = (projectId: string) => `/projects/${projectId}`
const realDraft = (draftId: string) => IS_REAL && isBackendId(draftId)

export async function listCharacters(token: string, projectId: string): Promise<Character[]> {
  if (!IS_REAL) return request<Character[]>('GET', `${p(projectId)}/characters`, { accessToken: token })
  const options = { accessToken: token }
  const [people, relationships, chapters, manuscripts] = await Promise.all([
    requestAll<BackendCharacter>(`${p(projectId)}/characters`, options),
    listRelationships(token, projectId),
    requestAll<BackendChapter>(`${p(projectId)}/chapters`, options),
    requestAll<BackendManuscript>(`${p(projectId)}/manuscripts`, options),
  ])
  return people.map((person) => {
    const connected = relationships.filter(
      (row) => row.source_character_id === person.character_id || row.target_character_id === person.character_id,
    )
    const changes = connected
      .flatMap((row) => {
        const otherId =
          row.source_character_id === person.character_id ? row.target_character_id : row.source_character_id
        const other = people.find((item) => item.character_id === otherId)?.name ?? '다른 인물'
        return row.history.map((entry) => ({
          chapter: entry.chapter,
          text: `${other} · ${entry.state} · ${manuscripts.find((m) => m.manuscript_id === entry.manuscript_id)?.title ?? '원고'}`,
        }))
      })
      .sort((a, b) => a.chapter - b.chapter)
    return {
      character_id: person.character_id,
      name: person.name,
      role_label: '인물',
      status_label: '확정됨',
      last_chapter:
        chapters
          .filter((ch) => ch.content.includes(person.name))
          .reduce((last, ch) => Math.max(last, ch.chapter_no), 0) || null,
      personality_tags: person.personality_tags.map((item) => item.value),
      core_values: person.core_values.map((item) => item.value),
      emotion_keywords: person.emotion_keywords.map((item) => item.value),
      influence_relations: person.influence_relations.map((item) => ({
        target: item.value,
        type: '영향',
        status: null,
      })),
      relationship_count: connected.length,
      key_changes: changes.slice(-4),
    }
  })
}

/** 서버가 연결 관계를 검사해 삭제 가능 여부를 판정한다. */
export function deleteCharacter(token: string, projectId: string, characterId: string) {
  return request<null>('DELETE', `${p(projectId)}/characters/${characterId}`, { accessToken: token })
}

/** 백엔드 NLCD 추출 — 인물 이름 필드가 name이다. 실패는 200 + data(status=failed) + error */
type BackendExtraction = Omit<NLExtraction, 'character_name'> & { name: string | null }
const toExtraction = ({ name, ...e }: BackendExtraction): NLExtraction => ({ ...e, character_name: name })
const realExtraction = async (method: string, path: string, options: Parameters<typeof request>[2]) =>
  toExtraction((await requestLenient<BackendExtraction>(method, path, options)).data)

/** NLCD 4.1 자연어 입력 제출 */
export function createExtraction(
  token: string,
  projectId: string,
  input: { source_text: string; character_name?: string; target_character_id?: string | null },
) {
  if (IS_REAL) {
    const { character_name, ...rest } = input
    return realExtraction('POST', `${p(projectId)}/nl-extractions`, {
      body: { ...rest, name: character_name || undefined },
      accessToken: token,
    })
  }
  return request<NLExtraction>('POST', `${p(projectId)}/nl-extractions`, { body: input, accessToken: token })
}

/** NLCD 4.2 결과 폴링 */
export function getExtraction(token: string, projectId: string, extractionId: string) {
  if (IS_REAL) return realExtraction('GET', `${p(projectId)}/nl-extractions/${extractionId}`, { accessToken: token })
  return request<NLExtraction>('GET', `${p(projectId)}/nl-extractions/${extractionId}`, { accessToken: token })
}

export function retryExtraction(token: string, projectId: string, extractionId: string) {
  if (IS_REAL)
    return realExtraction('POST', `${p(projectId)}/nl-extractions/${extractionId}/retry`, { accessToken: token })
  return request<NLExtraction>('POST', `${p(projectId)}/nl-extractions/${extractionId}/retry`, { accessToken: token })
}

/** NLCD 4.5 추출 결과를 ASS 초안으로 전달 (백엔드면 백엔드 초안 UUID가 온다) */
export function forwardExtraction(token: string, projectId: string, extractionId: string) {
  return request<{ extraction_id: string; forwarded_draft_id: string }>(
    'POST',
    `${p(projectId)}/nl-extractions/${extractionId}/forward`,
    { accessToken: token },
  )
}

const d = (projectId: string, draftId: string) => `${p(projectId)}/character-drafts/${draftId}`

export async function getDraft(token: string, projectId: string, draftId: string) {
  if (realDraft(draftId))
    return toDraft(await request<BackendDraft>('GET', d(projectId, draftId), { accessToken: token }))
  return request<CharacterDraft>('GET', d(projectId, draftId), { accessToken: token })
}

export async function renameDraft(token: string, projectId: string, draftId: string, character_name: string) {
  if (realDraft(draftId))
    return toDraft(
      await request<BackendDraft>('PATCH', d(projectId, draftId), { body: { character_name }, accessToken: token }),
    )
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
const backendItem = (input: ItemInput) => ({
  field: input.field,
  value: input.field === 'influence_relations' || input.target !== undefined ? influenceText(input) : input.value,
})

export async function addDraftItem(token: string, projectId: string, draftId: string, input: ItemInput) {
  if (realDraft(draftId))
    return toDraftItem(
      await request<BackendDraftItem>('POST', `${d(projectId, draftId)}/items`, {
        body: backendItem(input),
        accessToken: token,
      }),
    )
  return request<CharacterDraft['items'][number]>('POST', `${d(projectId, draftId)}/items`, {
    body: input,
    accessToken: token,
  })
}

export async function updateDraftItem(
  token: string,
  projectId: string,
  draftId: string,
  itemId: string,
  input: ItemInput,
) {
  if (realDraft(draftId))
    return toDraftItem(
      await request<BackendDraftItem>('PATCH', `${d(projectId, draftId)}/items/${itemId}`, {
        body: backendItem(input),
        accessToken: token,
      }),
    )
  return request<CharacterDraft['items'][number]>('PATCH', `${d(projectId, draftId)}/items/${itemId}`, {
    body: input,
    accessToken: token,
  })
}

export function deleteDraftItem(token: string, projectId: string, draftId: string, itemId: string) {
  return request<null>('DELETE', `${d(projectId, draftId)}/items/${itemId}`, { accessToken: token })
}

const FIELD_LABEL: Record<string, string> = {
  personality_tags: '성격 태그',
  core_values: '핵심 가치',
  influence_relations: '영향 관계',
  emotion_keywords: '감정 키워드',
  character_name: '인물 이름',
  name: '인물 이름',
}

export async function getDraftHistory(token: string, projectId: string, draftId: string) {
  if (!realDraft(draftId))
    return request<EditHistoryEntry[]>('GET', `${d(projectId, draftId)}/edit-history`, { accessToken: token })
  // 백엔드는 필드를 키로, 바뀐 값을 before/after로 준다 — 목업처럼 "카테고리 이름"과 "이전 → 이후"로 보여 준다
  const rows = await request<
    Array<{
      action: EditHistoryEntry['action']
      field: string
      value: string | null
      before_value: string | null
      after_value: string | null
      at: string
    }>
  >('GET', `${d(projectId, draftId)}/edit-history`, { accessToken: token })
  return rows.map(
    (h): EditHistoryEntry => ({
      action: h.action,
      field: FIELD_LABEL[h.field] ?? h.field,
      value:
        h.action === 'modified'
          ? `${h.before_value ?? '(없음)'} → ${h.after_value ?? ''}`
          : (h.value ?? h.after_value ?? h.before_value ?? ''),
      at: h.at,
    }),
  )
}

export function discardDraft(token: string, projectId: string, draftId: string) {
  return request<{ draft_id: string; status: string }>('POST', `${d(projectId, draftId)}/discard`, {
    accessToken: token,
  })
}

type ConfirmBody = { resolution?: 'merge' | 'create_new'; merge_target_character_id?: string }

/** ASS 4.9 확정 — 중복이면 409 후 resolution으로 다시 요청 */
export async function confirmDraft(
  token: string,
  projectId: string,
  draftId: string,
  body: ConfirmBody = {},
): Promise<Pick<Character, 'character_id' | 'name'>> {
  if (!IS_REAL) return request<Character>('POST', `${d(projectId, draftId)}/confirm`, { body, accessToken: token })
  return request<BackendCharacter>('POST', `${d(projectId, draftId)}/confirm`, { body, accessToken: token })
}
