import { roleOf, type BackendChapter, type BackendManuscript, type BackendMember, type BackendProject } from '../backendShapes'
import type { User } from '../types'
import { emptyWorld, loadDb, saveDb, type MockManuscript } from './db'
import { recordVersion } from './routes/manuscripts'

// 혼합 모드(real) 전용. 백엔드에 아직 없는 API(AI 분석·캐릭터·관계 등)를 목업이 받으려면
// 실제 서버의 사용자·프로젝트·원고·장을 알아야 한다. 요청 직전에 목업 DB로 옮겨 둔다.

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
}

const MS_STATUS: Record<BackendManuscript['status'], MockManuscript['status']> = {
  ready: 'ready',
  processing: 'processing',
  failed: 'extraction_failed',
  draft: 'extraction_failed',
}

/** 실제 프로젝트 한 개를 목업 DB에 덮어쓴다. 장 본문이 바뀌었으면 편집 이력 스냅샷도 남긴다 */
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
    if (prev && prev.content !== c.content) {
      row.updated_at = new Date().toISOString()
      recordVersion(db, row)
    }
    if (prev) Object.assign(prev, row)
    else db.chapters.push(row)
  }
  const chapterIds = new Set(chapters.map((c) => c.chapter_id))
  db.chapters = db.chapters.filter((c) => !ids.has(c.manuscript_id) || chapterIds.has(c.chapter_id))
  saveDb(db)
}
