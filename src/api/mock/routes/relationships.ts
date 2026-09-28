import type { MindmapGraph, Relationship, RelationshipSnapshot } from '../../types'
import { requireProject, touchProject } from '../access'
import { emptyWorld, type MockDb } from '../db'
import type { DemoRelationship } from '../demo'
import { fail, isResponse, nextId, noContent, ok, str, type Body, type MockRequest, type Route } from '../http'

export const STATES = ['우호', '중립', '긴장', '갈등', '적대', '신뢰']
const world = (db: MockDb, projectId: string) => (db.worlds[projectId] ??= emptyWorld())

type Entry = DemoRelationship['history'][number]

function toRelationship(r: DemoRelationship): Relationship {
  return {
    relationship_id: r.relationship_id,
    source_character_id: r.source,
    target_character_id: r.target,
    history: [...r.history]
      .sort((a, b) => a.chapter - b.chapter)
      .map((h) => ({ chapter: h.chapter, state: h.state, trust: h.trust, event_title: h.event, event_deleted: Boolean(h.event_deleted) })),
  }
}

/** RCV 4.9 — 요청한 장에 기록이 없으면 직전 장의 값을 이어받는다 */
export function snapshot(r: DemoRelationship, chapter: number): RelationshipSnapshot | null {
  const h = [...r.history].filter((x) => x.chapter <= chapter).sort((a, b) => b.chapter - a.chapter)[0]
  if (!h) return null
  return {
    relationship_id: r.relationship_id,
    requested_chapter: chapter,
    resolved_chapter: h.chapter,
    state: h.state,
    trust: h.trust,
    linked_event: h.event,
    is_carried_forward: h.chapter !== chapter,
  }
}

function readEntry(b: Body): { entry: Entry } | { error: string } {
  const chapter = Number(b.chapter)
  const state = str(b.state)
  const trust = b.trust === null || b.trust === undefined || b.trust === '' ? null : Number(b.trust)
  if (!Number.isInteger(chapter) || chapter < 1) return { error: '장 번호는 1 이상이어야 해요.' }
  if (!STATES.includes(state)) return { error: `관계 상태는 ${STATES.join('·')} 중에서 골라 주세요.` }
  if (trust !== null && (!Number.isFinite(trust) || trust < 0 || trust > 100)) return { error: '신뢰도는 0부터 100 사이로 입력해 주세요.' }
  return { entry: { chapter, state, trust: trust ?? 0, event: str(b.event_title) || null } }
}

function findRel(req: MockRequest, db: MockDb, params: Record<string, string>, minRole: 'viewer' | 'editor' = 'viewer') {
  const access = requireProject(req, db, params.projectId, minRole)
  if (isResponse(access)) return access
  const r = world(db, params.projectId).relationships.find((x) => x.relationship_id === params.relationshipId)
  return r ?? fail(404, 'RELATIONSHIP_NOT_FOUND', '관계를 찾을 수 없어요.')
}

const base = '/projects/:projectId/relationships'

// RCV 명세
export const relationshipRoutes: Route[] = [
  [
    'GET',
    base,
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      const characterId = req.query.character_id
      const rows = world(db, projectId).relationships.filter((r) => !characterId || r.source === characterId || r.target === characterId)
      return ok(200, rows.map(toRelationship), { next_cursor: null })
    },
  ],
  [
    'POST',
    base,
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const w = world(db, projectId)
      const b = (req.body ?? {}) as Body
      const source = str(b.source_character_id)
      const target = str(b.target_character_id)
      if (!source || !target || source === target) return fail(400, 'INVALID_INPUT', '서로 다른 두 인물을 골라 주세요.')
      if (!w.characters.some((c) => c.character_id === source) || !w.characters.some((c) => c.character_id === target)) {
        return fail(404, 'CHARACTER_NOT_FOUND', '인물을 찾을 수 없어요.')
      }
      if (w.relationships.some((r) => (r.source === source && r.target === target) || (r.source === target && r.target === source))) {
        return fail(409, 'RELATIONSHIP_EXISTS', '두 인물 사이에는 이미 관계가 있어요. 기존 관계에 상태를 기록해 주세요.')
      }
      const parsed = readEntry((b.initial_history ?? {}) as Body)
      if ('error' in parsed) return fail(400, 'INVALID_INPUT', parsed.error)
      const r: DemoRelationship = { relationship_id: nextId(db, 'rel'), source, target, history: [parsed.entry] }
      w.relationships.push(r)
      touchProject(db, projectId)
      return ok(201, toRelationship(r))
    },
  ],
  [
    'DELETE',
    `${base}/:relationshipId`,
    (req, db, params) => {
      const r = findRel(req, db, params, 'editor')
      if (isResponse(r)) return r
      const w = world(db, params.projectId)
      w.relationships = w.relationships.filter((x) => x !== r)
      touchProject(db, params.projectId)
      return noContent()
    },
  ],
  [
    // 4.6 특정 장 상태 기록 추가 — 같은 장에 기록이 있으면 409, overwrite=true면 갱신
    'POST',
    `${base}/:relationshipId/history`,
    (req, db, params) => {
      const r = findRel(req, db, params, 'editor')
      if (isResponse(r)) return r
      const parsed = readEntry((req.body ?? {}) as Body)
      if ('error' in parsed) return fail(400, 'INVALID_INPUT', parsed.error)
      const existing = r.history.find((h) => h.chapter === parsed.entry.chapter)
      if (existing && req.query.overwrite !== 'true') {
        return fail(409, 'DUPLICATE_CHAPTER_RECORD', '해당 장에 이미 관계 상태 기록이 있어요. overwrite=true로 다시 요청하면 새 값으로 바꿔요.', {
          existing_entry: { chapter: existing.chapter, state: existing.state, trust: existing.trust, event_title: existing.event },
        })
      }
      if (existing) Object.assign(existing, parsed.entry, { event_deleted: false })
      else r.history.push(parsed.entry)
      touchProject(db, params.projectId)
      return ok(201, toRelationship(r))
    },
  ],
  [
    'DELETE',
    `${base}/:relationshipId/history/:chapter`,
    (req, db, params) => {
      const r = findRel(req, db, params, 'editor')
      if (isResponse(r)) return r
      const chapter = Number(params.chapter)
      if (!r.history.some((h) => h.chapter === chapter)) return fail(404, 'HISTORY_ENTRY_NOT_FOUND', '해당 장의 기록이 없어요.')
      r.history = r.history.filter((h) => h.chapter !== chapter)
      touchProject(db, params.projectId)
      return noContent()
    },
  ],
  [
    // 4.10 장 시점 마인드맵
    'GET',
    '/projects/:projectId/relationship-mindmap',
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      const chapter = Number(req.query.chapter)
      if (!Number.isInteger(chapter) || chapter < 1) return fail(400, 'INVALID_INPUT', '기준 장을 골라 주세요.')
      const w = world(db, projectId)
      const focus = req.query.character_id
      const rels = w.relationships.filter((r) => !focus || r.source === focus || r.target === focus)
      const edges = rels
        .map((r) => {
          const s = snapshot(r, chapter)
          return s && { relationship_id: r.relationship_id, source_character_id: r.source, target_character_id: r.target, state: s.state, trust: s.trust, is_carried_forward: s.is_carried_forward, resolved_chapter: s.resolved_chapter }
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
      const ids = new Set(edges.flatMap((e) => [e.source_character_id, e.target_character_id]))
      if (focus) ids.add(focus)
      const graph: MindmapGraph = {
        chapter,
        nodes: w.characters.filter((c) => ids.has(c.character_id)).map((c) => ({ character_id: c.character_id, name: c.name, role_label: c.role_label })),
        edges,
      }
      return ok(200, graph)
    },
  ],
]
