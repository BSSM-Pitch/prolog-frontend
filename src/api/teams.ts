import { request, requestWithMeta } from './client'
import type { Project, Team, TeamInvitation, TeamMember, TeamRole } from './types'

// TEAM 명세

const base = (teamId: string) => `/teams/${teamId}`

/** 4.1 내가 속한 팀 목록 */
export function listTeams(accessToken: string) {
  return request<Team[]>('GET', '/teams', { accessToken })
}

/** 4.2 팀 생성 */
export function createTeam(accessToken: string, input: { name: string; description?: string }) {
  return request<Team>('POST', '/teams', { body: input, accessToken })
}

export function getTeam(accessToken: string, teamId: string) {
  return request<Team>('GET', base(teamId), { accessToken })
}

/** 4.5 팀 삭제 — 팀 프로젝트가 남아 있으면 409 TEAM_HAS_ACTIVE_PROJECTS */
export function deleteTeam(accessToken: string, teamId: string) {
  return request<null>('DELETE', base(teamId), { accessToken })
}

export function listTeamMembers(accessToken: string, teamId: string) {
  return request<TeamMember[]>('GET', `${base(teamId)}/members`, { accessToken })
}

/** 4.7 팀원 초대 */
export function inviteToTeam(accessToken: string, teamId: string, input: { invited_email: string; role: TeamInvitation['role'] }) {
  return requestWithMeta<TeamInvitation, { is_registered?: boolean }>('POST', `${base(teamId)}/invitations`, { body: input, accessToken })
}

/** 4.8 대기 중인 초대 */
export function listTeamInvitations(accessToken: string, teamId: string) {
  return request<TeamInvitation[]>('GET', `${base(teamId)}/invitations`, { accessToken })
}

/** 4.9 초대 수락 */
export function acceptTeamInvitation(accessToken: string, teamId: string, invitationId: string) {
  return request<TeamMember>('POST', `${base(teamId)}/invitations/${invitationId}/accept`, { accessToken })
}

/** 4.10 초대 취소 */
export function cancelTeamInvitation(accessToken: string, teamId: string, invitationId: string) {
  return request<null>('DELETE', `${base(teamId)}/invitations/${invitationId}`, { accessToken })
}

/** 4.11 팀원 역할 변경 */
export function changeTeamRole(accessToken: string, teamId: string, userId: string, role: TeamRole) {
  return request<TeamMember>('PATCH', `${base(teamId)}/members/${userId}`, { body: { role }, accessToken })
}

/** 4.12 팀원 제거 / 팀 탈퇴 */
export function removeTeamMember(accessToken: string, teamId: string, userId: string) {
  return request<null>('DELETE', `${base(teamId)}/members/${userId}`, { accessToken })
}

/** 4.13 팀 소속 프로젝트 */
export function listTeamProjects(accessToken: string, teamId: string) {
  return request<Project[]>('GET', `${base(teamId)}/projects`, { accessToken })
}
