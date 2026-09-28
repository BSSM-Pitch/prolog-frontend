import type { Character, CharacterDraft, NLExtraction } from '../../types'
import { requireProject, touchProject } from '../access'
import { extractCharacter } from '../ai'
import { emptyWorld, type MockDb, type MockDraft, type MockDraftItem, type MockExtraction } from '../db'
import type { DemoCharacter } from '../demo'
import { josa } from '../../../lib/josa'
import { fail, isResponse, nextId, noContent, ok, stamp, str, type Body, type MockRequest, type Route } from '../http'

const EXTRACT_MS = 2000
const FIELDS = ['personality_tags', 'core_values', 'influence_relations', 'emotion_keywords'] as const
type Field = (typeof FIELDS)[number]
const FIELD_LABEL: Record<Field, string> = {
  personality_tags: '성격 태그',
  core_values: '핵심 가치',
  influence_relations: '영향 관계',
  emotion_keywords: '감정 키워드',
}

const world = (db: MockDb, projectId: string) => (db.worlds[projectId] ??= emptyWorld())

function settleExtractions(db: MockDb) {
  for (const e of db.extractions) {
    if (e.status !== 'analyzing' || e.ready_at === null || e.ready_at > Date.now()) continue
    e.ready_at = null
    // 목업: 설명에 "[실패]"가 있으면 추출 실패를 흉내 낸다 (Figma 상태 명세의 "인물 정보를 읽지 못했어요")
    if (e.source_text.includes('[실패]')) e.status = 'failed'
    else {
      e.status = 'completed'
      e.result = extractCharacter(e.source_text)
    }
  }
}

function toExtraction(e: MockExtraction): NLExtraction {
  const r = e.result
  return {
    extraction_id: e.extraction_id,
    source_text: e.source_text,
    character_name: e.character_name,
    target_character_id: e.target_character_id,
    status: e.status,
    personality_tags: r?.personality_tags ?? [],
    core_values: r?.core_values ?? [],
    influence_relations: r?.influence_relations ?? [],
    emotion_keywords: r?.emotion_keywords ?? [],
    duplicate_of: e.duplicate_of,
    forwarded_draft_id: e.forwarded_draft_id,
    created_at: e.created_at,
  }
}

function toDraft(d: MockDraft): CharacterDraft {
  return {
    draft_id: d.draft_id,
    character_name: d.character_name,
    items: d.items.map((i) => ({ ...i, target: i.field === 'influence_relations' ? i.value : undefined })),
    status: d.status,
    target_character_id: d.target_character_id,
    confirmed_character_id: d.confirmed_character_id,
    created_at: d.created_at,
  }
}

/** 인물이 등장하는 관계에서 연결 수와 "12장 · 재현과 신뢰" 같은 주요 변화를 모은다 */
export function toCharacter(db: MockDb, projectId: string, c: DemoCharacter): Character {
  const w = world(db, projectId)
  const rels = w.relationships.filter((r) => r.source === c.character_id || r.target === c.character_id)
  const nameOf = (id: string) => w.characters.find((x) => x.character_id === id)?.name ?? '?'
  const changes = rels
    .flatMap((r) => {
      const other = nameOf(r.source === c.character_id ? r.target : r.source)
      return r.history.map((h) => ({ chapter: h.chapter, text: `${josa(other, '와/과')}의 관계가 ${h.state}(${h.trust})${h.event ? ` · ${h.event}` : ''}` }))
    })
    .sort((a, b) => a.chapter - b.chapter)
  return {
    character_id: c.character_id,
    name: c.name,
    role_label: c.role_label,
    status_label: c.status_label,
    last_chapter: c.last_chapter || null,
    personality_tags: c.personality_tags,
    core_values: c.core_values,
    influence_relations: c.influence_relations,
    emotion_keywords: c.emotion_keywords,
    relationship_count: rels.length,
    key_changes: changes.slice(-4),
  }
}

function findDraft(req: MockRequest, db: MockDb, params: Record<string, string>, minRole: 'viewer' | 'editor' = 'viewer') {
  const access = requireProject(req, db, params.projectId, minRole)
  if (isResponse(access)) return access
  const d = db.drafts.find((x) => x.draft_id === params.draftId && x.project_id === params.projectId)
  if (!d) return fail(404, 'DRAFT_NOT_FOUND', '초안을 찾을 수 없어요.')
  return d
}

function assertEditable(d: MockDraft) {
  return d.status === 'pending_review' ? null : fail(409, 'DRAFT_ALREADY_RESOLVED', '이미 확정했거나 폐기한 초안이에요.')
}

function itemText(i: Pick<MockDraftItem, 'value' | 'type' | 'status'>) {
  return [i.value, i.type && i.type !== '영향' ? i.type : null, i.status ? `상태: ${i.status}` : null].filter(Boolean).join(' · ')
}

const nl = '/projects/:projectId/nl-extractions'
const drafts = '/projects/:projectId/character-drafts'
const chars = '/projects/:projectId/characters'

export const characterRoutes: Route[] = [
  // ───────── NLCD ─────────
  [
    'POST',
    nl,
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const b = (req.body ?? {}) as Body
      const text = str(b.source_text)
      if (!text) return fail(400, 'INVALID_INPUT', '인물 설명을 입력해 주세요.', { field: 'source_text' })
      const targetId = str(b.target_character_id) || null
      if (targetId && !world(db, projectId).characters.some((c) => c.character_id === targetId)) {
        return fail(404, 'TARGET_CHARACTER_NOT_FOUND', '추가할 기존 인물을 찾을 수 없어요.')
      }
      const same = db.extractions.find((e) => e.project_id === projectId && e.source_text === text)
      const e: MockExtraction = {
        extraction_id: nextId(db, 'extract'),
        project_id: projectId,
        source_text: text,
        character_name: str(b.character_name) || null,
        target_character_id: targetId,
        status: 'analyzing',
        result: null,
        duplicate_of: same?.extraction_id ?? null,
        forwarded_draft_id: null,
        ready_at: Date.now() + EXTRACT_MS,
        created_at: stamp(),
      }
      db.extractions.push(e)
      return ok(202, toExtraction(e), same ? { notice: '이전에 비슷한 문장을 입력한 기록이 있어요. 추출이 끝나면 병합 여부를 확인해 주세요.' } : {})
    },
  ],
  [
    'GET',
    `${nl}/:extractionId`,
    (req, db, { projectId, extractionId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      settleExtractions(db)
      const e = db.extractions.find((x) => x.extraction_id === extractionId && x.project_id === projectId)
      return e ? ok(200, toExtraction(e), { retry_after_ms: e.status === 'analyzing' ? 1000 : null }) : fail(404, 'EXTRACTION_NOT_FOUND', '추출 작업을 찾을 수 없어요.')
    },
  ],
  [
    'POST',
    `${nl}/:extractionId/retry`,
    (req, db, { projectId, extractionId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const e = db.extractions.find((x) => x.extraction_id === extractionId && x.project_id === projectId)
      if (!e) return fail(404, 'EXTRACTION_NOT_FOUND', '추출 작업을 찾을 수 없어요.')
      if (e.status !== 'failed') return fail(409, 'INVALID_STATUS_TRANSITION', '실패한 추출만 다시 시도할 수 있어요.')
      e.status = 'analyzing'
      e.source_text = e.source_text.replace('[실패]', '').trim()
      e.ready_at = Date.now() + EXTRACT_MS
      return ok(202, toExtraction(e))
    },
  ],
  [
    // 4.5 추출 결과를 ASS 초안으로 전달
    'POST',
    `${nl}/:extractionId/forward`,
    (req, db, { projectId, extractionId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      settleExtractions(db)
      const e = db.extractions.find((x) => x.extraction_id === extractionId && x.project_id === projectId)
      if (!e) return fail(404, 'EXTRACTION_NOT_FOUND', '추출 작업을 찾을 수 없어요.')
      if (e.status !== 'completed' || !e.result) return fail(409, 'EXTRACTION_NOT_READY', '추출이 아직 끝나지 않았어요.', { status: e.status })
      if (e.forwarded_draft_id) return fail(409, 'ALREADY_FORWARDED', '이미 초안으로 넘긴 추출이에요.', { forwarded_draft_id: e.forwarded_draft_id })

      const items: MockDraftItem[] = FIELDS.flatMap((field) =>
        e.result![field].map((x) => ({ item_id: nextId(db, 'itm'), field, value: x.value, type: x.type, status: null, origin: 'ai_extracted' as const, evidence: x.evidence })),
      )
      const target = world(db, projectId).characters.find((c) => c.character_id === e.target_character_id)
      const d: MockDraft = {
        draft_id: nextId(db, 'draft'),
        project_id: projectId,
        character_name: e.character_name ?? target?.name ?? null,
        items,
        status: 'pending_review',
        source_extraction_id: e.extraction_id,
        target_character_id: e.target_character_id,
        confirmed_character_id: null,
        history: [],
        created_at: stamp(),
      }
      db.drafts.push(d)
      e.forwarded_draft_id = d.draft_id
      return ok(201, { extraction_id: e.extraction_id, forwarded_draft_id: d.draft_id })
    },
  ],

  // ───────── ASS ─────────
  [
    'GET',
    `${drafts}/:draftId`,
    (req, db, params) => {
      const d = findDraft(req, db, params)
      return isResponse(d) ? d : ok(200, toDraft(d))
    },
  ],
  [
    'PATCH',
    `${drafts}/:draftId`,
    (req, db, params) => {
      const d = findDraft(req, db, params, 'editor')
      if (isResponse(d)) return d
      const locked = assertEditable(d)
      if (locked) return locked
      const name = str((req.body as Body)?.character_name)
      if (!name) return fail(400, 'INVALID_INPUT', '인물 이름을 입력해 주세요.', { field: 'character_name' })
      d.history.push({ action: 'modified', field: 'character_name', value: `${d.character_name ?? '(없음)'} → ${name}`, at: stamp() })
      d.character_name = name
      return ok(200, toDraft(d))
    },
  ],
  [
    'POST',
    `${drafts}/:draftId/items`,
    (req, db, params) => {
      const d = findDraft(req, db, params, 'editor')
      if (isResponse(d)) return d
      const locked = assertEditable(d)
      if (locked) return locked
      const b = (req.body ?? {}) as Body
      const field = b.field as Field
      if (!FIELDS.includes(field)) return fail(400, 'INVALID_INPUT', '카테고리를 골라 주세요.', { field: 'field' })
      const value = str(field === 'influence_relations' ? (b.target ?? b.value) : b.value)
      if (!value) return fail(400, 'INVALID_INPUT', '값을 입력해 주세요.', { field: 'value' })
      const item: MockDraftItem = { item_id: nextId(db, 'itm'), field, value, type: str(b.type) || undefined, status: str(b.status) || null, origin: 'user_added', evidence: null }
      d.items.push(item)
      d.history.push({ action: 'added', field, value: itemText(item), at: stamp() })
      return ok(201, toDraft(d).items.find((i) => i.item_id === item.item_id))
    },
  ],
  [
    'PATCH',
    `${drafts}/:draftId/items/:itemId`,
    (req, db, params) => {
      const d = findDraft(req, db, params, 'editor')
      if (isResponse(d)) return d
      const locked = assertEditable(d)
      if (locked) return locked
      const item = d.items.find((i) => i.item_id === params.itemId)
      if (!item) return fail(404, 'ITEM_NOT_FOUND', '항목을 찾을 수 없어요.')
      const b = (req.body ?? {}) as Body
      const before = itemText(item)
      const value = b.target ?? b.value
      if (value !== undefined) {
        if (!str(value)) return fail(400, 'INVALID_INPUT', '값을 입력해 주세요.', { field: 'value' })
        item.value = str(value)
      }
      if (b.type !== undefined) item.type = str(b.type) || undefined
      if (b.status !== undefined) item.status = str(b.status) || null
      d.history.push({ action: 'modified', field: item.field, value: `${before} → ${itemText(item)}`, at: stamp() })
      return ok(200, toDraft(d).items.find((i) => i.item_id === item.item_id))
    },
  ],
  [
    'DELETE',
    `${drafts}/:draftId/items/:itemId`,
    (req, db, params) => {
      const d = findDraft(req, db, params, 'editor')
      if (isResponse(d)) return d
      const locked = assertEditable(d)
      if (locked) return locked
      const item = d.items.find((i) => i.item_id === params.itemId)
      if (!item) return fail(404, 'ITEM_NOT_FOUND', '항목을 찾을 수 없어요.')
      d.items = d.items.filter((i) => i !== item)
      d.history.push({ action: 'removed', field: item.field, value: itemText(item), at: stamp() })
      return noContent()
    },
  ],
  [
    'GET',
    `${drafts}/:draftId/edit-history`,
    (req, db, params) => {
      const d = findDraft(req, db, params)
      return isResponse(d) ? d : ok(200, d.history.map((h) => ({ ...h, field: FIELD_LABEL[h.field as Field] ?? '인물 이름' })))
    },
  ],
  [
    'POST',
    `${drafts}/:draftId/discard`,
    (req, db, params) => {
      const d = findDraft(req, db, params, 'editor')
      if (isResponse(d)) return d
      const locked = assertEditable(d)
      if (locked) return locked
      d.status = 'discarded'
      return ok(200, { draft_id: d.draft_id, status: d.status })
    },
  ],
  [
    // 4.9 확정 — 같은 이름의 인물이 있으면 409 후 resolution(merge | create_new)으로 다시 요청
    'POST',
    `${drafts}/:draftId/confirm`,
    (req, db, params) => {
      const d = findDraft(req, db, params, 'editor')
      if (isResponse(d)) return d
      const locked = assertEditable(d)
      if (locked) return locked
      const name = d.character_name?.trim()
      if (!name) return fail(400, 'MISSING_REQUIRED_FIELD', '인물 이름이 비어 있어 확정할 수 없어요.', { field: 'character_name' })

      const w = world(db, params.projectId)
      const b = (req.body ?? {}) as Body
      const byField = (f: Field) => d.items.filter((i) => i.field === f)
      const strings = (f: Exclude<Field, 'influence_relations'>) => byField(f).map((i) => i.value)
      const influences = byField('influence_relations').map((i) => ({ target: i.value, type: i.type ?? '영향', status: i.status ?? null }))

      const mergeTarget =
        b.resolution === 'merge'
          ? w.characters.find((c) => c.character_id === (str(b.merge_target_character_id) || d.target_character_id))
          : d.target_character_id && b.resolution !== 'create_new'
            ? w.characters.find((c) => c.character_id === d.target_character_id)
            : undefined

      if (!mergeTarget && b.resolution !== 'create_new') {
        const dup = w.characters.find((c) => c.name === name)
        if (dup) {
          return fail(409, 'DUPLICATE_CHARACTER_CANDIDATE', `확정된 인물 ${josa(name, '와/과')} 이름이 같아요. 이 초안을 어떻게 저장할지 골라 주세요.`, {
            candidate_character_id: dup.character_id,
            candidate_name: dup.name,
          })
        }
      }

      let target: DemoCharacter
      if (mergeTarget) {
        const add = (list: string[], more: string[]) => [...list, ...more.filter((m) => !list.includes(m))]
        mergeTarget.personality_tags = add(mergeTarget.personality_tags, strings('personality_tags'))
        mergeTarget.core_values = add(mergeTarget.core_values, strings('core_values'))
        mergeTarget.emotion_keywords = add(mergeTarget.emotion_keywords, strings('emotion_keywords'))
        mergeTarget.influence_relations = [...mergeTarget.influence_relations, ...influences.filter((i) => !mergeTarget.influence_relations.some((x) => x.target === i.target))]
        target = mergeTarget
      } else {
        target = {
          character_id: nextId(db, 'char'),
          name,
          role_label: '인물',
          status_label: '활동 중',
          last_chapter: 0,
          personality_tags: strings('personality_tags'),
          core_values: strings('core_values'),
          influence_relations: influences,
          emotion_keywords: strings('emotion_keywords'),
        }
        w.characters.push(target)
      }
      d.status = 'confirmed'
      d.confirmed_character_id = target.character_id
      touchProject(db, params.projectId)
      return ok(mergeTarget ? 200 : 201, toCharacter(db, params.projectId, target))
    },
  ],

  // ───────── 확정된 인물 ─────────
  [
    'GET',
    chars,
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      return ok(200, world(db, projectId).characters.map((c) => toCharacter(db, projectId, c)), { next_cursor: null })
    },
  ],
  [
    'GET',
    `${chars}/:characterId`,
    (req, db, { projectId, characterId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      const c = world(db, projectId).characters.find((x) => x.character_id === characterId)
      return c ? ok(200, toCharacter(db, projectId, c)) : fail(404, 'CHARACTER_NOT_FOUND', '인물을 찾을 수 없어요.')
    },
  ],
  [
    // (명세 미정의) 인물 삭제 — RCV 11항: 종속 관계가 남아 있으면 409
    'DELETE',
    `${chars}/:characterId`,
    (req, db, { projectId, characterId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const w = world(db, projectId)
      const c = w.characters.find((x) => x.character_id === characterId)
      if (!c) return fail(404, 'CHARACTER_NOT_FOUND', '인물을 찾을 수 없어요.')
      const deps = w.relationships.filter((r) => r.source === characterId || r.target === characterId)
      if (deps.length > 0) {
        const nameOf = (id: string) => w.characters.find((x) => x.character_id === id)?.name ?? '?'
        return fail(409, 'CHARACTER_HAS_DEPENDENT_RELATIONSHIPS', `${c.name}에게 연결된 관계가 ${deps.length}개 있어요. 관계를 먼저 정리해야 인물을 삭제할 수 있어요.`, {
          relationships: deps.map((r) => {
            const last = r.history[r.history.length - 1]
            return { relationship_id: r.relationship_id, other: nameOf(r.source === characterId ? r.target : r.source), latest_state: last ? `${last.state} ${last.trust}` : '상태 미정', history_count: r.history.length }
          }),
        })
      }
      w.characters = w.characters.filter((x) => x !== c)
      touchProject(db, projectId)
      return noContent()
    },
  ],
]
