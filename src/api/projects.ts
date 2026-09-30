import { roleOf, toProject, type BackendMember, type BackendProject } from './backendShapes'
import { request, requestAll, requestWithMeta } from './client'
import { IS_REAL } from './config'
import { getCurrentUserId } from './identity'
import type { OwnerType, Project, ProjectListMeta, ProjectOverview, ProjectSort } from './types'

export interface ListProjectsParams {
  owner_type?: OwnerType
  /** (명세 미정의) Figma "최근 수정순" 정렬 */
  sort?: ProjectSort
  limit?: number
  cursor?: string | null
}

/** PRJ 4.1 내가 접근 가능한 프로젝트 목록 (개인 + 참여 팀) */
export function listProjects(accessToken: string, params: ListProjectsParams = {}) {
  if (IS_REAL) return real.listProjects(accessToken, params)
  const query: Record<string, string> = {}
  if (params.owner_type) query.owner_type = params.owner_type
  if (params.sort) query.sort = params.sort
  if (params.limit) query.limit = String(params.limit)
  if (params.cursor) query.cursor = params.cursor
  return requestWithMeta<Project[], ProjectListMeta>('GET', '/projects', { query, accessToken })
}

/** PRJ 4.2 프로젝트 생성 */
export function createProject(accessToken: string, input: { title: string; owner_type: OwnerType; team_id?: string }) {
  if (IS_REAL) return real.createProject(accessToken, input)
  return request<Project>('POST', '/projects', { body: input, accessToken })
}

/** PRJ 4.3 프로젝트 상세 */
export function getProject(accessToken: string, projectId: string) {
  if (IS_REAL) return real.getProject(accessToken, projectId)
  return request<Project>('GET', `/projects/${projectId}`, { accessToken })
}

/** (명세 미정의) 개요 화면 요약 — 백엔드에 없어 real 모드에서도 목업이 계산한다 */
export function getOverview(accessToken: string, projectId: string) {
  return request<ProjectOverview>('GET', `/projects/${projectId}/overview`, { accessToken })
}

// --- real 모드: 백엔드 Project에는 team_name · my_role · 목록 counts · 정렬이 없어 채운다 ---------

const SORTERS: Record<ProjectSort, (a: Project, b: Project) => number> = {
  updated_desc: (a, b) => b.updated_at.localeCompare(a.updated_at),
  created_desc: (a, b) => b.created_at.localeCompare(a.created_at),
  title_asc: (a, b) => a.title.localeCompare(b.title, 'ko'),
}

const real = {
  async teamNames(token: string) {
    const teams = await requestAll<{ team_id: string; name: string }>('/teams', { accessToken: token })
    return new Map(teams.map((t) => [t.team_id, t.name]))
  },

  async role(token: string, p: BackendProject) {
    const members = await requestAll<BackendMember>(`/projects/${p.project_id}/members`, { accessToken: token }).catch(() => null)
    return roleOf(p, members, getCurrentUserId())
  },

  async listProjects(token: string, params: ListProjectsParams) {
    const query: Record<string, string> = { limit: String(params.limit ?? 20) }
    if (params.owner_type) query.owner_type = params.owner_type
    if (params.cursor) query.cursor = params.cursor
    const [page, names, all] = await Promise.all([
      requestWithMeta<BackendProject[], { next_cursor: string | null }>('GET', '/projects', { query, accessToken: token }),
      real.teamNames(token),
      // (명세 미정의) 탭 숫자 — 백엔드에 counts가 없어 한 번 더 받아 센다 (최대 100개)
      requestAll<BackendProject>('/projects', { accessToken: token }),
    ])
    const roles = await Promise.all(page.data.map((p) => real.role(token, p)))
    const data = page.data.map((p, i) => toProject(p, roles[i], p.team_id ? (names.get(p.team_id) ?? null) : null))
    // 백엔드는 생성순으로만 준다. 정렬은 받은 페이지 안에서만 맞춘다
    data.sort(SORTERS[params.sort ?? 'updated_desc'])
    const counts = { all: all.length, personal: all.filter((p) => p.owner_type === 'personal').length, team: all.filter((p) => p.owner_type === 'team').length }
    const meta: ProjectListMeta = { next_cursor: page.meta.next_cursor ?? null, counts }
    return { data, meta }
  },

  async createProject(token: string, input: { title: string; owner_type: OwnerType; team_id?: string }) {
    const p = await request<BackendProject>('POST', '/projects', { body: input, accessToken: token })
    const names = p.team_id ? await real.teamNames(token) : null
    return toProject(p, 'owner', p.team_id ? (names?.get(p.team_id) ?? null) : null)
  },

  async getProject(token: string, projectId: string) {
    const p = await request<BackendProject>('GET', `/projects/${projectId}`, { accessToken: token })
    const [role, names] = await Promise.all([real.role(token, p), p.team_id ? real.teamNames(token) : null])
    return toProject(p, role, p.team_id ? (names?.get(p.team_id) ?? null) : null)
  },
}
