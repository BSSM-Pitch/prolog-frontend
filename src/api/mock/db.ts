import type { AuthProvider, OwnerType, ProjectRole, UserRole } from '../types'
import { seedCollaboration, seedNotifications } from './collab'
import {
  DEMO_CHAPTERS,
  DEMO_CHARACTERS,
  DEMO_CONFLICTS,
  DEMO_FORESHADOWINGS,
  DEMO_PROJECT_ID,
  DEMO_RELATIONSHIPS,
  DEMO_RULES,
  DEMO_STORY,
  type DemoCharacter,
  type DemoConflict,
  type DemoForeshadowing,
  type DemoRelationship,
  type DemoRule,
  type DemoStoryNode,
} from './demo'

// 목업 서버 저장소. 브라우저 localStorage에 두어 새로고침해도 가입한 계정이 남는다.
// 실제 서버가 아니므로 비밀번호를 평문으로 저장한다 — 절대 실서비스 코드로 옮기지 말 것.

export interface MockUser {
  user_id: string
  username: string
  /** (명세 미정의) 아이디 찾기용 이름. Figma 회원가입 화면에는 입력 칸이 없다. */
  name: string | null
  email: string | null
  password: string | null
  role: UserRole
  auth_provider: AuthProvider
  provider_user_id: string | null
  created_at: string
  updated_at: string
}

interface PendingCode {
  code: string
  expires_at: number
}

export interface MockTeam {
  team_id: string
  name: string
  description?: string | null
  created_by?: string
  created_at?: string
}

export type TeamRole = 'owner' | 'admin' | 'member'

export interface MockTeamMember {
  team_id: string
  user_id: string
  role: TeamRole
  joined_at: string
}

/** PRJ 2.3 ProjectInvitation · TEAM 2.3 TeamInvitation. expires_at은 팀 명세(7일)를 프로젝트 초대에도 적용 */
export interface MockInvitation {
  invitation_id: string
  /** project_id 또는 team_id */
  target_id: string
  invited_email: string
  role: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  invited_by: string
  created_at: string
  expires_at: string
}

export interface MockProject {
  project_id: string
  title: string
  /** (명세 미정의) 개요 화면의 작품 소개 한 줄 */
  description: string | null
  owner_type: OwnerType
  team_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface MockManuscript {
  manuscript_id: string
  project_id: string
  title: string
  source_type: 'file' | 'editor'
  file_name: string | null
  file_format: string | null
  file_size: number | null
  status: 'processing' | 'ready' | 'extraction_failed'
  /** 목업: 이 시각이 지나면 processing → ready(또는 실패)로 바뀐다 */
  processing_until: number | null
  fail_extraction: boolean
  created_at: string
  updated_at: string
}

export interface MockChapter {
  chapter_id: string
  manuscript_id: string
  chapter_no: number
  title: string | null
  content: string
  updated_at: string
}

/** (명세 미정의) 편집 이력 스냅샷 — 장 하나의 본문을 그 시점 그대로 보관한다 */
export interface MockVersion {
  version_id: string
  manuscript_id: string
  chapter_id: string
  chapter_no: number
  chapter_title: string | null
  reason: 'edit' | 'autosave' | 'file_upload' | 'import'
  label: string | null
  content: string
  created_at: string
}

export type NotificationType = 'team_invite' | 'project_invite' | 'team_joined' | 'mention' | 'system'

/** NOTI 2.1 — related_ref.parent_id는 초대를 수락할 때 쓸 팀·프로젝트 ID (명세 미정의) */
export interface MockNotification {
  notification_id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  related_ref: { type: string; id: string; parent_id?: string } | null
  channels_sent: Array<'in_app' | 'email'>
  read_at: string | null
  created_at: string
}

/** NOTI 2.3 */
export interface MockEmailIntegration {
  integration_id: string
  user_id: string
  provider: 'gmail' | 'naver'
  email_address: string
  connected_at: string
}

export interface MockQAThread {
  thread_id: string
  project_id: string
  manuscript_id: string
  scope: 'whole' | 'selection'
  /** (명세 미정의) 선택 범위가 속한 장. 명세의 selection_range는 원고 전체 기준 오프셋이라 장 단위 편집기와 맞지 않는다 */
  chapter_id: string | null
  selection_range: { start: number; end: number } | null
  selected_text: string | null
  title: string
  created_at: string
  updated_at: string
}

export interface MockQAMessage {
  message_id: string
  thread_id: string
  role: 'user' | 'assistant'
  content: string | null
  status: 'pending' | 'completed' | 'failed'
  citations: Array<{ chapter_no: number; chapter_title: string | null; quote: string }>
  /** 목업: 이 시각이 지나면 답변이 완성된다 */
  ready_at: number | null
  will_fail: boolean
  created_at: string
}

export interface MockExtraction {
  extraction_id: string
  project_id: string
  source_text: string
  character_name: string | null
  target_character_id: string | null
  status: 'analyzing' | 'completed' | 'failed'
  result: import('./ai').ReturnTypeExtract | null
  duplicate_of: string | null
  forwarded_draft_id: string | null
  ready_at: number | null
  created_at: string
}

export interface MockDraftItem {
  item_id: string
  field: 'personality_tags' | 'core_values' | 'influence_relations' | 'emotion_keywords'
  value: string
  type?: string
  status?: string | null
  origin: 'ai_extracted' | 'user_added'
  evidence: string | null
}

export interface MockDraft {
  draft_id: string
  project_id: string
  character_name: string | null
  items: MockDraftItem[]
  status: 'pending_review' | 'confirmed' | 'discarded'
  source_extraction_id: string | null
  target_character_id: string | null
  confirmed_character_id: string | null
  history: Array<{ action: 'added' | 'modified' | 'removed'; field: string; value: string; at: string }>
  created_at: string
}

/** SCDS 충돌 검사 · REX 규칙 추출 작업 (목업: ready_at이 지나면 끝난다) */
export interface MockJob {
  job_id: string
  project_id: string
  kind: 'conflict_check' | 'rule_extraction' | 'structure_analysis'
  status: 'queued' | 'analyzing' | 'completed' | 'failed' | 'skipped'
  manuscript_id: string | null
  ready_at: number | null
  will_fail: boolean
  result_ids: string[]
  skipped_reason: string | null
  created_at: string
}

/** 작품별 이야기 세계 (인물·관계·충돌·복선·스토리 지도·규칙). 해당 화면을 만들면서 API로 노출한다. */
export interface MockWorld {
  characters: DemoCharacter[]
  relationships: DemoRelationship[]
  conflicts: DemoConflict[]
  foreshadowings: DemoForeshadowing[]
  /** 본편(장이 가장 많은 원고)의 스토리 지도 */
  story: MockStory | null
  /** 본편이 아닌 원고의 스토리 지도 (원고 ID별) */
  stories?: Record<string, MockStory>
  rules: DemoRule[]
}

export type MockStory = { acts: typeof DEMO_STORY.acts; nodes: DemoStoryNode[]; edges: typeof DEMO_STORY.edges }

export interface MockProjectMember {
  project_id: string
  user_id: string
  role: ProjectRole
  /** 예전 저장본에는 없을 수 있다 */
  joined_at?: string
}

export interface MockDb {
  users: MockUser[]
  teams: MockTeam[]
  projects: MockProject[]
  projectMembers: MockProjectMember[]
  projectInvitations: MockInvitation[]
  teamMembers: MockTeamMember[]
  teamInvitations: MockInvitation[]
  notifications: MockNotification[]
  /** NOTI 2.2 — 사용자별로 바꾼 설정만 둔다. 없으면 모두 켜짐 */
  notificationSettings: Record<string, Partial<Record<NotificationType, { in_app_enabled: boolean; email_enabled: boolean }>>>
  emailIntegrations: MockEmailIntegration[]
  manuscripts: MockManuscript[]
  chapters: MockChapter[]
  versions: MockVersion[]
  worlds: Record<string, MockWorld>
  qaThreads: MockQAThread[]
  qaMessages: MockQAMessage[]
  extractions: MockExtraction[]
  drafts: MockDraft[]
  jobs: MockJob[]
  /** SCDS: 무시한 충돌이 다시 감지되지 않도록 보관하는 키 */
  suppressions: string[]
  signupCodes: Record<string, PendingCode>
  resetCodes: Record<string, PendingCode>
  refreshTokens: Record<string, { user_id: string; revoked: boolean }>
  accessTokens: Record<string, { user_id: string; expires_at: number }>
  seq: number
}

const STORAGE_KEY = 'prolog.mock-db.v2'
const LEGACY_KEY = 'prolog.mock-db.v1'

const now = new Date('2026-08-12T09:00:00Z').toISOString()

function seed(): MockDb {
  return seedCollaboration({
    users: [
      {
        user_id: 'user_101',
        username: 'writer_kim',
        name: '김유진',
        email: 'writer.kim@example.com',
        password: 'prolog1234',
        role: 'writer',
        auth_provider: 'local',
        provider_user_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        user_id: 'user_102',
        username: 'yujin_google',
        name: '김유진',
        email: 'yujin.kim@gmail.com',
        password: null,
        role: 'writer',
        auth_provider: 'google',
        provider_user_id: 'google-sub-demo',
        created_at: now,
        updated_at: now,
      },
    ],
    ...seedProjects(),

    qaThreads: [],
    qaMessages: [],
    extractions: [],
    drafts: [],
    jobs: [],
    suppressions: [],
    signupCodes: {},
    resetCodes: {},
    refreshTokens: {},
    accessTokens: {},
    seq: 300,
    // seedCollaboration이 채운다
    projectInvitations: [],
    teamMembers: [],
    teamInvitations: [],
    notifications: [],
    notificationSettings: {},
    emailIntegrations: [],
  })
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export function emptyWorld(): MockWorld {
  return { characters: [], relationships: [], conflicts: [], foreshadowings: [], story: null, rules: [] }
}

function demoWorld(): MockWorld {
  return {
    characters: clone(DEMO_CHARACTERS),
    relationships: clone(DEMO_RELATIONSHIPS),
    conflicts: clone(DEMO_CONFLICTS),
    foreshadowings: clone(DEMO_FORESHADOWINGS),
    story: clone(DEMO_STORY),
    rules: clone(DEMO_RULES),
  }
}

type ProjectSeed = Pick<MockDb, 'teams' | 'projects' | 'projectMembers' | 'manuscripts' | 'chapters' | 'versions' | 'worlds'>

// Figma 27 · 내 프로젝트의 예시 데이터(writer_kim 기준). 수정 시각은 "2시간 전" 등이 그대로 보이도록 지금 기준으로 만든다.
function seedProjects(): ProjectSeed {
  const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()
  const rows: Array<[string, string, OwnerType, string | null, ProjectRole, number, number]> = [
    // id, 제목, 소유 유형, 팀, writer_kim의 역할, 원고 수, 몇 시간 전 수정
    ['proj_1', '붉은 문 너머', 'team', 'team_10', 'owner', 3, 2],
    ['proj_2', '여름의 기록', 'team', 'team_10', 'editor', 1, 26],
    ['proj_3', '유리 도시', 'team', 'team_10', 'viewer', 2, 72],
    ['proj_4', '겨울 정원', 'personal', null, 'owner', 1, 24 * 7],
    ['proj_5', '해리포터', 'personal', null, 'owner', 4, 24 * 14],
    ['proj_6', '소금 창고의 밤', 'team', 'team_10', 'editor', 2, 24 * 21],
    ['proj_7', '바다의 문법', 'personal', null, 'owner', 1, 24 * 40],
    ['proj_8', '밤의 정원사', 'personal', null, 'owner', 0, 24 * 75],
  ]

  const manuscripts: MockManuscript[] = []
  const chapters: MockChapter[] = []
  let seq = 1
  function addManuscript(projectId: string, title: string, source: 'file' | 'editor', chapterTexts: Array<{ no: number; title: string; body: string }>, hours: number) {
    const manuscript_id = `ms_${String(seq++).padStart(3, '0')}`
    manuscripts.push({
      manuscript_id,
      project_id: projectId,
      title,
      source_type: source,
      file_name: source === 'file' ? `${title.replace(/ /g, '_')}.docx` : null,
      file_format: source === 'file' ? 'docx' : null,
      file_size: source === 'file' ? 1_800_000 : null,
      status: 'ready',
      processing_until: null,
      fail_extraction: false,
      created_at: ago(hours + 24),
      updated_at: ago(hours),
    })
    chapterTexts.forEach((c) =>
      chapters.push({ chapter_id: `${manuscript_id}_ch${c.no}`, manuscript_id, chapter_no: c.no, title: c.title, content: c.body, updated_at: ago(hours) }),
    )
  }

  for (const [project_id, title, , , , count, hours] of rows) {
    if (project_id === DEMO_PROJECT_ID) {
      addManuscript(project_id, '1차 원고', 'editor', DEMO_CHAPTERS.slice(0, 12), hours + 24 * 60)
      addManuscript(project_id, '2차 원고', 'editor', DEMO_CHAPTERS.slice(0, 26), hours + 24 * 37)
      addManuscript(project_id, '3차 원고', 'file', DEMO_CHAPTERS, hours)
      continue
    }
    for (let i = 1; i <= count; i++) {
      addManuscript(project_id, `${i}차 원고`, 'editor', [{ no: 1, title: '1장', body: `${title}의 첫 장면.` }], hours + (count - i) * 48)
    }
  }

  return {
    teams: [{ team_id: 'team_10', name: '문장 수집소' }],
    versions: seedVersions(chapters),
    projects: rows.map(([project_id, title, owner_type, team_id, role, , hours]) => ({
      project_id,
      title,
      description: project_id === DEMO_PROJECT_ID ? '서울 외곽의 폐역과 사라진 기록을 둘러싼 미스터리 장편소설.' : null,
      owner_type,
      team_id,
      created_by: role === 'owner' ? 'user_101' : 'user_150',
      created_at: ago(hours + 24 * 90),
      updated_at: ago(hours),
    })),
    projectMembers: rows.map(([project_id, , , , role]) => ({ project_id, user_id: 'user_101', role })),
    manuscripts,
    chapters,
    worlds: Object.fromEntries(rows.map(([project_id]) => [project_id, project_id === DEMO_PROJECT_ID ? demoWorld() : emptyWorld()])),
  }
}

// Figma 32 · 원고 편집 이력의 예시 스냅샷 (3차 원고, 최신이 먼저)
function seedVersions(chapters: MockChapter[]): MockVersion[] {
  const ms = 'ms_003'
  const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()
  const ch = (no: number) => chapters.find((c) => c.manuscript_id === ms && c.chapter_no === no)
  // 문장을 뒤에서부터 덜어 내 예전 본문처럼 만든다
  const earlier = (text: string, drop: number) => {
    const parts = text.match(/[^.!?。]+[.!?。]?/g) ?? [text]
    return parts.slice(0, Math.max(1, parts.length - drop)).join('').trim()
  }
  const rows: Array<[number, MockVersion['reason'], string | null, number, number]> = [
    // 장, 이유, 제목, 몇 시간 전, 덜어 낼 문장 수
    [27, 'edit', null, 0.4, 0],
    [1, 'file_upload', '3차 원고 불러옴', 0.8, 0],
    [27, 'autosave', null, 17, 1],
    [26, 'autosave', null, 17.5, 0],
    [26, 'autosave', null, 26, 1],
    [25, 'autosave', null, 30, 0],
    [24, 'autosave', null, 50, 0],
    [23, 'edit', null, 55, 1],
    [22, 'autosave', null, 74, 0],
    [21, 'autosave', null, 76, 1],
    [20, 'autosave', null, 96, 0],
    [1, 'import', '2차 원고 불러옴', 99, 0],
  ]
  return rows.flatMap(([no, reason, label, hours, drop], i) => {
    const c = ch(no)
    if (!c) return []
    return {
      version_id: `ver_${String(rows.length - i).padStart(3, '0')}`,
      manuscript_id: ms,
      chapter_id: c.chapter_id,
      chapter_no: no,
      chapter_title: c.title,
      reason,
      label,
      content: earlier(c.content, drop),
      created_at: ago(hours),
    }
  })
}

/** 나중에 추가된 테이블이 예전 저장본에 없으면 빈 값으로 채운다 */
function withDefaults(db: MockDb): MockDb {
  db.versions ??= seedVersions(db.chapters)
  // 협업(멤버·팀·초대) 데이터가 없는 저장본에는 시연용 사람들을 채운다
  if (!db.teamMembers) seedCollaboration(db)
  else if (!db.notifications) seedNotifications(db)
  db.qaThreads ??= []
  db.qaMessages ??= []
  db.extractions ??= []
  db.drafts ??= []
  db.jobs ??= []
  db.suppressions ??= []
  return db
}

export function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return withDefaults(JSON.parse(raw) as MockDb)
    // v1(로그인 기능만 있던 때) 저장소가 있으면 가입한 계정만 옮겨 온다
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const db = seed()
      const old = JSON.parse(legacy) as Pick<MockDb, 'users' | 'seq'>
      db.users = old.users ?? db.users
      db.seq = Math.max(db.seq, old.seq ?? 0)
      return db
    }
  } catch {
    // 저장소를 못 읽으면 초기 데이터로 시작
  }
  return seed()
}

export function saveDb(db: MockDb) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // 시크릿 모드 등에서는 메모리에서만 유지
  }
}

export function resetMockDb() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // 무시
  }
}
