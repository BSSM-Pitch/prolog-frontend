import { request, requestWithMeta } from './client'
import type { OwnerType, Project, ProjectListMeta, ProjectOverview, ProjectSort, Team } from './types'

export interface ListProjectsParams {
  owner_type?: OwnerType
  /** (명세 미정의) Figma "최근 수정순" 정렬 */
  sort?: ProjectSort
  limit?: number
  cursor?: string | null
}

/** PRJ 4.1 내가 접근 가능한 프로젝트 목록 (개인 + 참여 팀) */
export function listProjects(accessToken: string, params: ListProjectsParams = {}) {
  const query: Record<string, string> = {}
  if (params.owner_type) query.owner_type = params.owner_type
  if (params.sort) query.sort = params.sort
  if (params.limit) query.limit = String(params.limit)
  if (params.cursor) query.cursor = params.cursor
  return requestWithMeta<Project[], ProjectListMeta>('GET', '/projects', { query, accessToken })
}

/** PRJ 4.2 프로젝트 생성 */
export function createProject(accessToken: string, input: { title: string; owner_type: OwnerType; team_id?: string }) {
  return request<Project>('POST', '/projects', { body: input, accessToken })
}

/** PRJ 4.3 프로젝트 상세 */
export function getProject(accessToken: string, projectId: string) {
  return request<Project>('GET', `/projects/${projectId}`, { accessToken })
}

/** (명세 미정의) 개요 화면 요약 */
export function getOverview(accessToken: string, projectId: string) {
  return request<ProjectOverview>('GET', `/projects/${projectId}/overview`, { accessToken })
}

/** TEAM 4.1 내가 속한 팀 목록 */
export function listTeams(accessToken: string) {
  return request<Team[]>('GET', '/teams', { accessToken })
}
