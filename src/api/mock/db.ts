import type { AuthProvider, OwnerType, ProjectRole, UserRole } from '../types'

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
}

export interface MockProject {
  project_id: string
  title: string
  owner_type: OwnerType
  team_id: string | null
  created_by: string
  manuscript_count: number
  created_at: string
  updated_at: string
}

export interface MockProjectMember {
  project_id: string
  user_id: string
  role: ProjectRole
}

export interface MockDb {
  users: MockUser[]
  teams: MockTeam[]
  projects: MockProject[]
  projectMembers: MockProjectMember[]
  signupCodes: Record<string, PendingCode>
  resetCodes: Record<string, PendingCode>
  refreshTokens: Record<string, { user_id: string; revoked: boolean }>
  accessTokens: Record<string, { user_id: string; expires_at: number }>
  seq: number
}

const STORAGE_KEY = 'prolog.mock-db.v1'

const now = new Date('2026-08-12T09:00:00Z').toISOString()

function seed(): MockDb {
  return {
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
    signupCodes: {},
    resetCodes: {},
    refreshTokens: {},
    accessTokens: {},
    seq: 200,
  }
}

// Figma 27 · 내 프로젝트의 예시 데이터(writer_kim 기준). 수정 시각은 "2시간 전" 등이 그대로 보이도록 지금 기준으로 만든다.
function seedProjects(): Pick<MockDb, 'teams' | 'projects' | 'projectMembers'> {
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
  return {
    teams: [{ team_id: 'team_10', name: '문장 수집소' }],
    projects: rows.map(([project_id, title, owner_type, team_id, role, manuscript_count, hours]) => ({
      project_id,
      title,
      owner_type,
      team_id,
      created_by: role === 'owner' ? 'user_101' : 'user_150',
      manuscript_count,
      created_at: ago(hours + 24 * 30),
      updated_at: ago(hours),
    })),
    projectMembers: rows.map(([project_id, , , , role]) => ({ project_id, user_id: 'user_101', role })),
  }
}

export function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const db = JSON.parse(raw) as MockDb
      // 프로젝트 기능 이전에 저장된 목업 DB에는 예시 프로젝트를 채워 넣는다
      if (!db.projects) Object.assign(db, seedProjects())
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
  } catch {
    // 무시
  }
}
