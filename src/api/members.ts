import { request, requestWithMeta } from './client'
import type { ProjectInvitation, ProjectMember, ProjectRole } from './types'

// PRJ 4.6 ~ 4.11 멤버와 초대

const base = (projectId: string) => `/projects/${projectId}`

export function listMembers(accessToken: string, projectId: string) {
  return request<ProjectMember[]>('GET', `${base(projectId)}/members`, { accessToken })
}

/** (명세 미정의) 보낸 초대 목록 */
export function listInvitations(accessToken: string, projectId: string) {
  return request<ProjectInvitation[]>('GET', `${base(projectId)}/invitations`, { accessToken })
}

/** 4.7 공동 작업자 초대. meta.is_registered(명세 미정의)로 가입 여부를 알려 준다 */
export function invite(accessToken: string, projectId: string, input: { invited_email: string; role: ProjectInvitation['role'] }) {
  return requestWithMeta<ProjectInvitation, { is_registered?: boolean }>('POST', `${base(projectId)}/invitations`, { body: input, accessToken })
}

/** 4.8 초대 수락 */
export function acceptInvitation(accessToken: string, projectId: string, invitationId: string) {
  return request<ProjectMember>('POST', `${base(projectId)}/invitations/${invitationId}/accept`, { accessToken })
}

/** 4.9 초대 취소 */
export function cancelInvitation(accessToken: string, projectId: string, invitationId: string) {
  return request<null>('DELETE', `${base(projectId)}/invitations/${invitationId}`, { accessToken })
}

/** 4.10 멤버 역할 변경 */
export function changeRole(accessToken: string, projectId: string, userId: string, role: ProjectRole) {
  return request<ProjectMember>('PATCH', `${base(projectId)}/members/${userId}`, { body: { role }, accessToken })
}

/** 4.11 멤버 제거 / 프로젝트 나가기 */
export function removeMember(accessToken: string, projectId: string, userId: string) {
  return request<null>('DELETE', `${base(projectId)}/members/${userId}`, { accessToken })
}
