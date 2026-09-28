import { roleOf, toProject, type BackendMember, type BackendProject } from './backendShapes'
import { request, requestWithMeta } from './client'
import { IS_REAL } from './config'
import { getCurrentUserId } from './identity'
import { rememberInvitation, sentInvitations } from './sentInvitations'
import type { Project, Team, TeamInvitation, TeamMember, TeamRole } from './types'

// TEAM 명세

const base = (teamId: string) => `/teams/${teamId}`

/** 백엔드 Team — my_role · project_count · pending_invitation_count(명세 미정의)가 없다 */
interface BackendTeam {
  team_id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
  member_count: number
}

const toMember = (teamId: string, m: BackendMember): TeamMember => ({
  team_id: teamId,
  user_id: m.user_id,
  role: m.role as TeamRole,
  joined_at: m.joined_at,
  name: m.username,
  email: null,
})

/** real 모드: 화면에 필요한 값을 팀원·팀 프로젝트·초대 목록으로 채운다 */
async function enrich(token: string, t: BackendTeam): Promise<Team> {
  const me = getCurrentUserId()
  const [members, projects] = await Promise.all([
    request<BackendMember[]>('GET', `${base(t.team_id)}/members`, { accessToken: token }),
    request<BackendProject[]>('GET', `${base(t.team_id)}/projects`, { accessToken: token, query: { limit: '100' } }),
  ])
  const my_role = (members.find((m) => m.user_id === me)?.role ?? 'member') as TeamRole
  const invites = my_role === 'member' ? null : await request<TeamInvitation[]>('GET', `${base(t.team_id)}/invitations`, { accessToken: token }).catch(() => null)
  return {
    team_id: t.team_id,
    name: t.name,
    description: t.description,
    created_by: t.created_by,
    member_count: t.member_count,
    created_at: t.created_at,
    my_role,
    project_count: projects.length,
    pending_invitation_count: invites ? invites.filter((i) => i.status === 'pending').length : null,
  }
}

/** 4.1 내가 속한 팀 목록 */
export async function listTeams(accessToken: string) {
  if (!IS_REAL) return request<Team[]>('GET', '/teams', { accessToken })
  const rows = await request<BackendTeam[]>('GET', '/teams', { accessToken, query: { limit: '100' } })
  return Promise.all(rows.map((t) => enrich(accessToken, t)))
}

/** 4.2 팀 생성 */
export async function createTeam(accessToken: string, input: { name: string; description?: string }) {
  const t = await request<Team>('POST', '/teams', { body: input, accessToken })
  return IS_REAL ? { ...t, my_role: 'owner' as const, project_count: 0, pending_invitation_count: 0 } : t
}

export async function getTeam(accessToken: string, teamId: string) {
  if (!IS_REAL) return request<Team>('GET', base(teamId), { accessToken })
  return enrich(accessToken, await request<BackendTeam>('GET', base(teamId), { accessToken }))
}

/** 4.5 팀 삭제 — 팀 프로젝트가 남아 있으면 409 TEAM_HAS_ACTIVE_PROJECTS */
export function deleteTeam(accessToken: string, teamId: string) {
  return request<null>('DELETE', base(teamId), { accessToken })
}

export async function listTeamMembers(accessToken: string, teamId: string) {
  if (!IS_REAL) return request<TeamMember[]>('GET', `${base(teamId)}/members`, { accessToken })
  return (await request<BackendMember[]>('GET', `${base(teamId)}/members`, { accessToken })).map((m) => toMember(teamId, m))
}

/** 4.7 팀원 초대 — 응답의 token으로 초대 링크를 만든다 */
export async function inviteToTeam(accessToken: string, teamId: string, input: { invited_email: string; role: TeamInvitation['role'] }) {
  const res = await requestWithMeta<TeamInvitation, { is_registered?: boolean }>('POST', `${base(teamId)}/invitations`, { body: input, accessToken })
  // 목록 API에는 토큰이 없어, 링크를 다시 복사할 수 있게 이 브라우저에 남긴다
  if (res.data.token) rememberInvitation(`team:${teamId}`, res.data)
  return res
}

/** 4.8 대기 중인 초대 — 이 브라우저에서 보낸 초대는 링크 토큰을 붙여 준다 */
export async function listTeamInvitations(accessToken: string, teamId: string): Promise<TeamInvitation[]> {
  const rows = await request<TeamInvitation[]>('GET', `${base(teamId)}/invitations`, { accessToken })
  const tokens = new Map(sentInvitations<TeamInvitation>(`team:${teamId}`).map((i) => [i.invitation_id, i.token]))
  return rows.map((i): TeamInvitation => ({ ...i, token: i.token ?? tokens.get(i.invitation_id) }))
}

/** 4.9 초대 수락 — 초대 링크의 token이 필요하다 */
export function acceptTeamInvitation(accessToken: string, teamId: string, invitationId: string, token = '') {
  return request<TeamMember>('POST', `${base(teamId)}/invitations/${invitationId}/accept`, { body: { token }, accessToken })
}

/** 4.10 초대 취소 */
export function cancelTeamInvitation(accessToken: string, teamId: string, invitationId: string) {
  return request<null>('DELETE', `${base(teamId)}/invitations/${invitationId}`, { accessToken })
}

/** 4.11 팀원 역할 변경 */
export async function changeTeamRole(accessToken: string, teamId: string, userId: string, role: TeamRole) {
  const updated = await request<TeamMember>('PATCH', `${base(teamId)}/members/${userId}`, { body: { role }, accessToken })
  if (!IS_REAL) return updated
  const found = (await listTeamMembers(accessToken, teamId)).find((m) => m.user_id === userId)
  return found ?? { ...updated, name: '', email: null }
}

/** 4.12 팀원 제거 / 팀 탈퇴 */
export function removeTeamMember(accessToken: string, teamId: string, userId: string) {
  return request<null>('DELETE', `${base(teamId)}/members/${userId}`, { accessToken })
}

/** 4.13 팀 소속 프로젝트 */
export async function listTeamProjects(accessToken: string, teamId: string) {
  if (!IS_REAL) return request<Project[]>('GET', `${base(teamId)}/projects`, { accessToken })
  const rows = await request<BackendProject[]>('GET', `${base(teamId)}/projects`, { accessToken, query: { limit: '100' } })
  // 팀 프로젝트는 팀원에게 editor 이상 — 목록에서는 멤버 조회를 생략하고 그 규칙으로 표시한다
  return rows.map((p) => toProject(p, roleOf(p, null, getCurrentUserId()), null))
}
