import { requestWithMeta } from './client'
import type { OwnerType, Project, ProjectListMeta, ProjectSort } from './types'

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
