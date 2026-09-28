import type { RawResponse } from '../client'
import type { ProjectRole } from '../types'
import type { MockDb, MockProject, MockUser } from './db'
import { authenticate, fail, isResponse, type MockRequest } from './http'

export interface ProjectAccess {
  user: MockUser
  project: MockProject
  role: ProjectRole
}

const RANK: Record<ProjectRole, number> = { viewer: 0, editor: 1, owner: 2 }

/** 로그인 + 프로젝트 멤버 확인. minRole보다 낮으면 403 (PRJ 명세 권한 구조) */
export function requireProject(req: MockRequest, db: MockDb, projectId: string, minRole: ProjectRole = 'viewer'): ProjectAccess | RawResponse {
  const user = authenticate(req, db)
  if (isResponse(user)) return user
  const project = db.projects.find((p) => p.project_id === projectId)
  if (!project) return fail(404, 'PROJECT_NOT_FOUND', '프로젝트를 찾을 수 없어요.')
  const member = db.projectMembers.find((m) => m.project_id === projectId && m.user_id === user.user_id)
  if (!member) return fail(403, 'FORBIDDEN', '이 프로젝트에 참여하고 있지 않아요.')
  if (RANK[member.role] < RANK[minRole]) return fail(403, 'FORBIDDEN', '이 작업을 할 권한이 없어요.')
  return { user, project, role: member.role }
}

export function touchProject(db: MockDb, projectId: string) {
  const p = db.projects.find((x) => x.project_id === projectId)
  if (p) p.updated_at = new Date().toISOString()
}
