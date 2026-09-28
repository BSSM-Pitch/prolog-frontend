// AUTH API 명세 2장 데이터 모델

export type UserRole = 'writer' | 'aspiring_writer' | 'reader'
export type AuthProvider = 'local' | 'google' | 'naver'
export type OAuthProvider = Exclude<AuthProvider, 'local'>

export interface User {
  user_id: string
  username: string
  email: string | null
  role: UserRole
  auth_provider: AuthProvider
  created_at: string
  updated_at: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface AuthResult {
  user: User
  tokens: AuthTokens
}

// PRJ API 명세 2장 데이터 모델

export type OwnerType = 'personal' | 'team'
export type ProjectRole = 'owner' | 'editor' | 'viewer'

export interface Project {
  project_id: string
  title: string
  /** (명세 미정의) 개요 화면의 작품 소개 한 줄 */
  description: string | null
  owner_type: OwnerType
  team_id: string | null
  /** (명세 미정의) 카드의 "팀 · 문장 수집소" 표시용 */
  team_name: string | null
  /** (명세 미정의) 카드의 소유자·편집자·보기 전용 표시용 — 요청한 사용자의 역할 */
  my_role: ProjectRole
  created_by: string
  manuscript_count: number
  created_at: string
  updated_at: string
}

export type ProjectSort = 'updated_desc' | 'created_desc' | 'title_asc'

export interface ListMeta {
  next_cursor: string | null
}

export interface ProjectListMeta extends ListMeta {
  /** (명세 미정의) 탭의 "전체 5 · 개인 2 · 팀 3" 표시용 */
  counts: Record<'all' | OwnerType, number>
}

// TEAM 명세 2.1 (목록에 필요한 필드만)
export interface Team {
  team_id: string
  name: string
}

// MSU 명세 2장
export type ManuscriptSource = 'file' | 'editor'
export type ManuscriptStatus = 'processing' | 'ready' | 'extraction_failed'

export interface Manuscript {
  manuscript_id: string
  project_id: string
  title: string
  source_type: ManuscriptSource
  file_name: string | null
  file_format: string | null
  /** (명세 미정의) 업로드 목록의 "1.8MB" 표시용 */
  file_size: number | null
  chapter_count: number
  /** (명세 미정의) "82,420자" 표시용 */
  char_count: number
  status: ManuscriptStatus
  error: { code: string; message: string } | null
  created_at: string
  updated_at: string
}

export interface Chapter {
  chapter_id: string
  manuscript_id: string
  chapter_no: number
  title: string | null
  content: string
  updated_at: string
}

/** (명세 미정의) GET /projects/{id}/overview — Figma 01 개요의 요약 카드 */
export interface ProjectOverview {
  current_manuscript: { manuscript_id: string; title: string; last_chapter: number } | null
  story: { event_count: number; analyzed_through: number } | null
  tasks: { conflicts_pending: number; foreshadowing_unscheduled: number }
  relationships: {
    chapter: number
    center: { character_id: string; name: string; role_label: string }
    edges: Array<{ character_id: string; name: string; state: string; trust: number }>
  } | null
  priority: { conflict_id: string; index: number; title: string; severity: 'high' | 'medium' | 'low'; chapters: number[] } | null
}

export interface ApiErrorBody {
  code: string
  message: string
  details: Record<string, unknown>
}
