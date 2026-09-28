import type { Advisory, Foreshadowing } from '../../types'
import { requireProject, touchProject } from '../access'
import { emptyWorld, type MockDb } from '../db'
import type { DemoForeshadowing } from '../demo'
import { fail, isResponse, nextId, noContent, ok, str, type Body, type MockRequest, type Route } from '../http'

const world = (db: MockDb, projectId: string) => (db.worlds[projectId] ??= emptyWorld())

function toForeshadowing(f: DemoForeshadowing): Foreshadowing {
  return {
    foreshadowing_id: f.foreshadowing_id,
    code: f.code,
    title: f.title,
    description: f.description,
    setup_chapter: f.setup_chapter,
    linked_chapters: [...f.linked_chapters].sort((a, b) => a - b),
    payoff_chapter: f.payoff_chapter,
    status: f.payoff_chapter === null ? 'unresolved' : 'resolved',
    linked_characters: f.characters,
    linked_events: f.events,
  }
}

/** FTS 4.11 — 경과 장 수 기준 우선순위 (초기 제안값: 10 미만 low, 10~25 medium, 25 초과 high) */
export function priorityOf(elapsed: number): Advisory['priority'] {
  return elapsed > 25 ? 'high' : elapsed >= 10 ? 'medium' : 'low'
}

/** 제목 낱말이 겹치면 비슷한 복선으로 본다 (FTS 12항 "중복 복선 등록") */
function similar(a: string, b: string) {
  const words = (s: string) => new Set(s.split(/\s+/).map((w) => w.replace(/(의|은|는|이|가|을|를)$/, '')).filter((w) => w.length >= 2))
  const wa = words(a)
  return [...words(b)].some((w) => wa.has(w))
}

function findFs(req: MockRequest, db: MockDb, params: Record<string, string>, minRole: 'viewer' | 'editor' = 'editor') {
  const access = requireProject(req, db, params.projectId, minRole)
  if (isResponse(access)) return access
  const f = world(db, params.projectId).foreshadowings.find((x) => x.foreshadowing_id === params.foreshadowingId)
  return f ?? fail(404, 'FORESHADOWING_NOT_FOUND', '복선을 찾을 수 없어요.')
}

const nextCode = (list: DemoForeshadowing[]) => `F${String(list.reduce((max, f) => Math.max(max, Number(f.code.slice(1)) || 0), 0) + 1).padStart(2, '0')}`

const base = '/projects/:projectId/foreshadowings'

// FTS 명세
export const foreshadowingRoutes: Route[] = [
  [
    'GET',
    base,
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      const { status, linked_character } = req.query
      const rows = world(db, projectId)
        .foreshadowings.map(toForeshadowing)
        .filter((f) => !status || f.status === status)
        .filter((f) => !linked_character || f.linked_characters.includes(linked_character))
      return ok(200, rows, { next_cursor: null })
    },
  ],
  [
    // 4.2 생성 — 비슷한 복선이 있어도 막지 않고 meta.similar_candidates로 알려 준다
    'POST',
    base,
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const b = (req.body ?? {}) as Body
      const title = str(b.title)
      const setup = Number(b.setup_chapter)
      if (!title) return fail(400, 'INVALID_INPUT', '복선 제목을 입력해 주세요.', { field: 'title' })
      if (!Number.isInteger(setup) || setup < 1) return fail(400, 'INVALID_INPUT', '설치 장을 입력해 주세요.', { field: 'setup_chapter' })
      const w = world(db, projectId)
      const f: DemoForeshadowing = {
        foreshadowing_id: nextId(db, 'fs'),
        code: nextCode(w.foreshadowings),
        title,
        description: str(b.description),
        setup_chapter: setup,
        linked_chapters: [],
        payoff_chapter: null,
        characters: Array.isArray(b.linked_characters) ? b.linked_characters.map(str).filter(Boolean) : [],
        events: [],
      }
      const candidates = w.foreshadowings.filter((x) => similar(x.title, title)).map((x) => ({ foreshadowing_id: x.foreshadowing_id, code: x.code, title: x.title, setup_chapter: x.setup_chapter, payoff_chapter: x.payoff_chapter }))
      w.foreshadowings.push(f)
      touchProject(db, projectId)
      return ok(201, toForeshadowing(f), { similar_candidates: candidates })
    },
  ],
  [
    'PATCH',
    `${base}/:foreshadowingId`,
    (req, db, params) => {
      const f = findFs(req, db, params)
      if (isResponse(f)) return f
      const b = (req.body ?? {}) as Body
      if (b.title !== undefined) {
        if (!str(b.title)) return fail(400, 'INVALID_INPUT', '복선 제목을 입력해 주세요.', { field: 'title' })
        f.title = str(b.title)
      }
      if (b.description !== undefined) f.description = str(b.description)
      if (b.setup_chapter !== undefined) {
        const setup = Number(b.setup_chapter)
        if (!Number.isInteger(setup) || setup < 1) return fail(400, 'INVALID_INPUT', '설치 장을 확인해 주세요.', { field: 'setup_chapter' })
        if (f.payoff_chapter !== null && f.payoff_chapter < setup) return fail(400, 'INVALID_PAYOFF_CHAPTER', '설치 장이 회수 장보다 뒤일 수 없어요.')
        f.setup_chapter = setup
        f.linked_chapters = f.linked_chapters.filter((c) => c > setup)
      }
      if (Array.isArray(b.linked_characters)) f.characters = b.linked_characters.map(str).filter(Boolean)
      touchProject(db, params.projectId)
      return ok(200, toForeshadowing(f))
    },
  ],
  [
    'DELETE',
    `${base}/:foreshadowingId`,
    (req, db, params) => {
      const f = findFs(req, db, params)
      if (isResponse(f)) return f
      const w = world(db, params.projectId)
      w.foreshadowings = w.foreshadowings.filter((x) => x !== f)
      touchProject(db, params.projectId)
      return noContent()
    },
  ],
  [
    // 4.6 연결 장 추가
    'POST',
    `${base}/:foreshadowingId/linked-chapters`,
    (req, db, params) => {
      const f = findFs(req, db, params)
      if (isResponse(f)) return f
      const chapter = Number((req.body as Body)?.chapter)
      if (!Number.isInteger(chapter) || chapter <= f.setup_chapter) return fail(400, 'INVALID_INPUT', `연결 장은 설치 장(${f.setup_chapter}장)보다 뒤여야 해요.`, { field: 'chapter' })
      if (!f.linked_chapters.includes(chapter)) f.linked_chapters.push(chapter)
      touchProject(db, params.projectId)
      return ok(201, toForeshadowing(f))
    },
  ],
  [
    'DELETE',
    `${base}/:foreshadowingId/linked-chapters/:chapter`,
    (req, db, params) => {
      const f = findFs(req, db, params)
      if (isResponse(f)) return f
      const chapter = Number(params.chapter)
      if (!f.linked_chapters.includes(chapter)) return fail(404, 'LINKED_CHAPTER_NOT_FOUND', '연결된 장이 아니에요.')
      f.linked_chapters = f.linked_chapters.filter((c) => c !== chapter)
      touchProject(db, params.projectId)
      return noContent()
    },
  ],
  [
    // 4.8 회수 처리
    'PUT',
    `${base}/:foreshadowingId/payoff`,
    (req, db, params) => {
      const f = findFs(req, db, params)
      if (isResponse(f)) return f
      const payoff = Number((req.body as Body)?.payoff_chapter)
      if (!Number.isInteger(payoff) || payoff < 1) return fail(400, 'INVALID_INPUT', '회수 장을 입력해 주세요.', { field: 'payoff_chapter' })
      if (payoff < f.setup_chapter) {
        return fail(400, 'INVALID_PAYOFF_CHAPTER', `회수 장(${payoff}장)은 설치 장(${f.setup_chapter}장)보다 앞설 수 없어요.`, { setup_chapter: f.setup_chapter, requested_payoff_chapter: payoff })
      }
      f.payoff_chapter = payoff
      touchProject(db, params.projectId)
      return ok(200, toForeshadowing(f))
    },
  ],
  [
    // 4.9 회수 취소
    'DELETE',
    `${base}/:foreshadowingId/payoff`,
    (req, db, params) => {
      const f = findFs(req, db, params)
      if (isResponse(f)) return f
      if (f.payoff_chapter === null) return fail(409, 'PAYOFF_NOT_SET', '이 복선은 아직 회수되지 않아 회수 취소를 할 수 없어요.')
      f.payoff_chapter = null
      touchProject(db, params.projectId)
      return ok(200, toForeshadowing(f))
    },
  ],
  [
    // 4.11 미회수 안내 (결정론적 템플릿)
    'GET',
    `${base}/unresolved/advisories`,
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      const current = Number(req.query.current_chapter)
      if (!Number.isInteger(current) || current < 1) return fail(400, 'INVALID_INPUT', '현재 장을 알려 주세요.', { field: 'current_chapter' })
      const rows: Advisory[] = world(db, projectId)
        .foreshadowings.filter((f) => f.payoff_chapter === null)
        .map((f) => {
          const elapsed = Math.max(0, current - f.setup_chapter)
          return {
            foreshadowing_id: f.foreshadowing_id,
            message: `${f.setup_chapter}장에 설치한 '${f.title}' 복선이 아직 회수되지 않았어요. 지금 흐름에서 다시 언급하거나 회수를 고려해 보세요.`,
            setup_chapter: f.setup_chapter,
            latest_linked_chapter: f.linked_chapters.length ? Math.max(...f.linked_chapters) : null,
            elapsed_chapters: elapsed,
            priority: priorityOf(elapsed),
          }
        })
        .sort((a, b) => b.elapsed_chapters - a.elapsed_chapters)
      return ok(200, rows)
    },
  ],
]
