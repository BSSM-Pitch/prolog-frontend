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

export interface ApiErrorBody {
  code: string
  message: string
  details: Record<string, unknown>
}
