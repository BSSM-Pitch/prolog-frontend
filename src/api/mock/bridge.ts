import {
  CATEGORIES,
  codesByCreation,
  isBackendId,
  roleOf,
  type BackendChapter,
  type BackendCharacter,
  type BackendForeshadowing,
  type BackendManuscript,
  type BackendMember,
  type BackendProject,
  type BackendWorldRule,
} from '../backendShapes'
import type { User } from '../types'
import { emptyWorld, loadDb, saveDb, type MockDb, type MockManuscript } from './db'
import type { DemoCharacter, DemoForeshadowing, DemoRule } from './demo'

// 혼합 모드(real) 전용. 백엔드에 아직 없는 API(AI 분석·관계·충돌·스토리 지도 등)를 목업이 받으려면
// 실제 서버의 사용자·프로젝트·원고·장·인물·규칙·복선을 알아야 한다. 요청 직전에 목업 DB로 옮겨 둔다.

/** 실제 서버로 로그인한 사용자를 목업 사용자로 등록한다 */
export function bridgeUser(user: User) {
  const db = loadDb()
  const row = db.users.find((u) => u.user_id === user.user_id)
  const next = {
    user_id: user.user_id,
    username: user.username,
    name: user.username,
    email: user.email,
    password: null,
    role: user.role,
    auth_provider: user.auth_provider,
    provider_user_id: null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  }
  if (row) Object.assign(row, next)
  else db.users.push(next)
  db.bridgeUserId = user.user_id
  saveDb(db)
}

interface ProjectSnapshot {
  project: Record<string, unknown>
  members: Array<Record<string, unknown>>
  manuscripts: Array<Record<string, unknown>>
  chapters: Array<Record<string, unknown>>
  characters: Array<Record<string, unknown>>
  rules: Array<Record<string, unknown>>
  foreshadowings: Array<Record<string, unknown>>
}

const MS_STATUS: Record<BackendManuscript['status'], MockManuscript['status']> = {
  ready: 'ready',
  processing: 'processing',
  failed: 'extraction_failed',
  draft: 'extraction_failed',
}

/** 실제 프로젝트 한 개를 목업 DB에 덮어쓴다 (편집 이력은 백엔드가 남긴다) */
export function mirrorProject(snapshot: ProjectSnapshot) {
  const db = loadDb()
  const me = db.bridgeUserId ?? null
  const p = snapshot.project as unknown as BackendProject
  const members = snapshot.members as unknown as BackendMember[]

  const project = {
    project_id: p.project_id,
    title: p.title,
    description: p.description,
    owner_type: p.owner_type,
    team_id: p.team_id,
    created_by: p.created_by,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
  const i = db.projects.findIndex((x) => x.project_id === p.project_id)
  if (i >= 0) db.projects[i] = project
  else db.projects.push(project)
  db.worlds[p.project_id] ??= emptyWorld()

  if (me) {
    const role = roleOf(p, members, me)
    const m = db.projectMembers.find((x) => x.project_id === p.project_id && x.user_id === me)
    if (m) m.role = role
    else db.projectMembers.push({ project_id: p.project_id, user_id: me, role, joined_at: p.created_at })
  }

  const manuscripts = snapshot.manuscripts as unknown as BackendManuscript[]
  const ids = new Set(manuscripts.map((m) => m.manuscript_id))
  db.manuscripts = db.manuscripts.filter((m) => m.project_id !== p.project_id || ids.has(m.manuscript_id))
  for (const m of manuscripts) {
    const fileName = m.file_key?.split('/').pop() ?? null
    const row: MockManuscript = {
      manuscript_id: m.manuscript_id,
      project_id: m.project_id,
      title: m.title,
      source_type: m.source_type === 'upload' ? 'file' : 'editor',
      file_name: fileName,
      file_format: fileName?.split('.').pop() ?? null,
      file_size: null,
      status: MS_STATUS[m.status] ?? 'ready',
      processing_until: null,
      fail_extraction: false,
      created_at: m.created_at,
      updated_at: m.updated_at,
    }
    const j = db.manuscripts.findIndex((x) => x.manuscript_id === m.manuscript_id)
    if (j >= 0) db.manuscripts[j] = row
    else db.manuscripts.push(row)
  }

  const chapters = snapshot.chapters as unknown as BackendChapter[]
  for (const c of chapters) {
    const prev = db.chapters.find((x) => x.chapter_id === c.chapter_id)
    const row = { chapter_id: c.chapter_id, manuscript_id: c.manuscript_id, chapter_no: c.chapter_no, title: c.title, content: c.content, updated_at: prev?.updated_at ?? new Date().toISOString() }
    if (prev && prev.content !== c.content) row.updated_at = new Date().toISOString()
    if (prev) Object.assign(prev, row)
    else db.chapters.push(row)
  }
  const chapterIds = new Set(chapters.map((c) => c.chapter_id))
  db.chapters = db.chapters.filter((c) => !ids.has(c.manuscript_id) || chapterIds.has(c.chapter_id))
  mirrorWorld(db, p.project_id, snapshot)
  saveDb(db)
}

/**
 * 인물·규칙·복선은 백엔드가 정본이다. 목업 쪽에는 백엔드에 없는 것만 남긴다:
 * 인물의 역할·상태 표시, AI가 뽑은 규칙 후보(pending·ignored). 관계는 사라진 인물을 가리키면 버린다.
 */
function mirrorWorld(db: MockDb, projectId: string, snapshot: ProjectSnapshot) {
  const w = (db.worlds[projectId] ??= emptyWorld())
  const chapters = db.chapters.filter((c) => db.manuscripts.some((m) => m.manuscript_id === c.manuscript_id && m.project_id === projectId))

  const characters = snapshot.characters as unknown as BackendCharacter[]
  w.characters = characters.map((c): DemoCharacter => {
    const prev = w.characters.find((x) => x.character_id === c.character_id)
    const values = (f: (typeof CATEGORIES)[number]) => c[f].map((a) => a.value)
    return {
      character_id: c.character_id,
      name: c.name,
      role_label: prev?.role_label ?? '인물',
      status_label: prev?.status_label ?? '활동 중',
      // 마지막 등장 장 — 이름이 나오는 가장 뒤의 장
      last_chapter: chapters.filter((ch) => ch.content.includes(c.name)).reduce((max, ch) => Math.max(max, ch.chapter_no), 0),
      personality_tags: values('personality_tags'),
      core_values: values('core_values'),
      influence_relations: c.influence_relations.map((a) => ({ target: a.value, type: '영향', status: null })),
      emotion_keywords: values('emotion_keywords'),
    }
  })
  const alive = new Set(w.characters.map((c) => c.character_id))
  w.relationships = w.relationships.filter((r) => alive.has(r.source) && alive.has(r.target))

  const rules = snapshot.rules as unknown as BackendWorldRule[]
  const codes = codesByCreation(rules, (r) => r.rule_id, 'R')
  const candidates = w.rules.filter((r) => !isBackendId(r.rule_id) && r.status !== 'confirmed')
  w.rules = [
    ...rules.map((r): DemoRule => ({
      rule_id: r.rule_id,
      code: codes.get(r.rule_id)!,
      title: r.title,
      description: r.description,
      violation_keywords: r.violation_keywords,
      origin: r.origin,
      status: 'confirmed',
      source_chapter: r.source_chapter_no,
      evidence: r.evidence,
    })),
    // 후보 번호는 확정 규칙 뒤로 이어 붙인다
    ...candidates.map((r, i) => ({ ...r, code: `R${String(rules.length + i + 1).padStart(2, '0')}` })),
  ]

  const foreshadowings = snapshot.foreshadowings as unknown as BackendForeshadowing[]
  const fsCodes = codesByCreation(foreshadowings, (f) => f.foreshadowing_id, 'F')
  const nameOf = new Map(w.characters.map((c) => [c.character_id, c.name]))
  w.foreshadowings = foreshadowings.map((f): DemoForeshadowing => ({
    foreshadowing_id: f.foreshadowing_id,
    code: fsCodes.get(f.foreshadowing_id)!,
    title: f.title,
    description: f.description ?? '',
    setup_chapter: f.setup_chapter ?? 0,
    linked_chapters: f.linked_chapters,
    payoff_chapter: f.payoff_chapter,
    characters: f.linked_character_ids.map((id) => nameOf.get(id)).filter((n): n is string => Boolean(n)),
    events: [],
  }))
}

/** AI 초안(목업)을 백엔드에 옮겨 확정했으면 목업 초안도 확정으로 닫는다 */
export function markDraftConfirmed(draftId: string, characterId: string) {
  const db = loadDb()
  const d = db.drafts.find((x) => x.draft_id === draftId)
  if (!d) return
  d.status = 'confirmed'
  d.confirmed_character_id = characterId
  saveDb(db)
}
