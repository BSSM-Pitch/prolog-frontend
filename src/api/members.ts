import type { BackendMember } from './backendShapes'
import { request, requestWithMeta } from './client'
import { IS_REAL } from './config'
import { forgetInvitation, rememberInvitation, sentInvitations } from './sentInvitations'
import type { ProjectInvitation, ProjectMember, ProjectRole } from './types'

// PRJ 4.6 ~ 4.11 멤버와 초대

const base = (projectId: string) => `/projects/${projectId}`

/** 백엔드는 이름을 username으로 준다(이메일 없음) */
const toMember = (projectId: string, m: BackendMember): ProjectMember => ({
  project_id: projectId,
  user_id: m.user_id,
  role: m.role as ProjectRole,
  joined_at: m.joined_at,
  name: m.username,
  email: null,
})

export async function listMembers(accessToken: string, projectId: string) {
  if (!IS_REAL) return request<ProjectMember[]>('GET', `${base(projectId)}/members`, { accessToken })
  const rows = await request<BackendMember[]>('GET', `${base(projectId)}/members`, { accessToken })
  return rows.map((m) => toMember(projectId, m))
}

/** (명세 미정의) 보낸 초대 목록. real 모드는 백엔드에 없어 이 브라우저에서 보낸 것만 보여 준다 */
export async function listInvitations(accessToken: string, projectId: string) {
  if (!IS_REAL) return request<ProjectInvitation[]>('GET', `${base(projectId)}/invitations`, { accessToken })
  const now = Date.now()
  return sentInvitations<ProjectInvitation>(`project:${projectId}`).map((i) => (i.status === 'pending' && new Date(i.expires_at).getTime() <= now ? { ...i, status: 'expired' as const } : i))
}

/** 4.7 공동 작업자 초대 (owner만). 응답의 token으로 초대 링크를 만든다 */
export async function invite(accessToken: string, projectId: string, input: { invited_email: string; role: ProjectInvitation['role'] }) {
  const res = await requestWithMeta<ProjectInvitation, { is_registered?: boolean }>('POST', `${base(projectId)}/invitations`, { body: input, accessToken })
  if (IS_REAL) rememberInvitation(`project:${projectId}`, res.data)
  return res
}

/** 4.8 초대 수락 — 초대 링크의 token이 필요하다 */
export function acceptInvitation(accessToken: string, projectId: string, invitationId: string, token = '') {
  return request<ProjectMember>('POST', `${base(projectId)}/invitations/${invitationId}/accept`, { body: { token }, accessToken })
}

/** 4.9 초대 취소 */
export async function cancelInvitation(accessToken: string, projectId: string, invitationId: string) {
  await request<null>('DELETE', `${base(projectId)}/invitations/${invitationId}`, { accessToken })
  if (IS_REAL) forgetInvitation(`project:${projectId}`, invitationId)
  return null
}

/** 4.10 멤버 역할 변경 (owner만) */
export async function changeRole(accessToken: string, projectId: string, userId: string, role: ProjectRole) {
  const updated = await request<ProjectMember>('PATCH', `${base(projectId)}/members/${userId}`, { body: { role }, accessToken })
  if (!IS_REAL) return updated
  // 백엔드 응답에는 username이 없어 목록에서 다시 찾는다
  const found = (await listMembers(accessToken, projectId)).find((m) => m.user_id === userId)
  return found ?? { ...updated, name: '', email: null }
}

/** 4.11 멤버 제거 / 프로젝트 나가기 */
export function removeMember(accessToken: string, projectId: string, userId: string) {
  return request<null>('DELETE', `${base(projectId)}/members/${userId}`, { accessToken })
}
