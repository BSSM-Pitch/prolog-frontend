import type { Team, TeamInvitation, TeamMember, TeamRole } from '../../types'
import type { MockDb, MockInvitation, MockTeam, MockTeamMember, MockUser } from '../db'
import { authenticate, fail, isResponse, lower, nextId, noContent, ok, stamp, str, type Body, type Route } from '../http'
import type { MockRequest } from '../http'
import type { RawResponse } from '../../client'
import { newInvitation, settleInvitations } from './members'
import { toProject } from './projects'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RANK: Record<TeamRole, number> = { owner: 0, admin: 1, member: 2 }
const ROLES = Object.keys(RANK) as TeamRole[]

interface TeamAccess {
  user: MockUser
  team: MockTeam
  role: TeamRole
}

/** 로그인 + 팀원 확인. minRole보다 낮으면 403 */
function requireTeam(req: MockRequest, db: MockDb, teamId: string, minRole: TeamRole = 'member'): TeamAccess | RawResponse {
  const user = authenticate(req, db)
  if (isResponse(user)) return user
  const team = db.teams.find((t) => t.team_id === teamId)
  if (!team) return fail(404, 'TEAM_NOT_FOUND', '팀을 찾을 수 없어요.')
  const member = db.teamMembers.find((m) => m.team_id === teamId && m.user_id === user.user_id)
  if (!member) return fail(403, 'FORBIDDEN', '이 팀의 팀원이 아니에요.')
  if (RANK[member.role] > RANK[minRole]) return fail(403, 'FORBIDDEN', '이 작업을 할 권한이 없어요.')
  return { user, team, role: member.role }
}

const teamMembers = (db: MockDb, teamId: string) => db.teamMembers.filter((m) => m.team_id === teamId)
const teamProjects = (db: MockDb, teamId: string) => db.projects.filter((p) => p.team_id === teamId)

function toTeam(db: MockDb, t: MockTeam, role: TeamRole): Team {
  settleInvitations(db.teamInvitations)
  return {
    team_id: t.team_id,
    name: t.name,
    description: t.description ?? null,
    created_by: t.created_by ?? '',
    member_count: teamMembers(db, t.team_id).length,
    created_at: t.created_at ?? stamp(),
    my_role: role,
    project_count: teamProjects(db, t.team_id).length,
    pending_invitation_count: role === 'member' ? null : db.teamInvitations.filter((i) => i.target_id === t.team_id && i.status === 'pending').length,
  }
}

function toMember(db: MockDb, m: MockTeamMember): TeamMember {
  const u = db.users.find((x) => x.user_id === m.user_id)
  return { team_id: m.team_id, user_id: m.user_id, role: m.role, joined_at: m.joined_at, name: u?.name ?? u?.username ?? '알 수 없는 사용자', email: u?.email ?? null }
}

function toInvitation(i: MockInvitation): TeamInvitation {
  return { invitation_id: i.invitation_id, team_id: i.target_id, invited_email: i.invited_email, role: i.role as TeamInvitation['role'], status: i.status, created_at: i.created_at, expires_at: i.expires_at }
}

const isLastOwner = (db: MockDb, teamId: string, userId: string) => {
  const owners = teamMembers(db, teamId).filter((m) => m.role === 'owner')
  return owners.length === 1 && owners[0].user_id === userId
}

// TEAM 명세
export const teamRoutes: Route[] = [
  [
    // 4.1 내가 속한 팀 목록
    'GET',
    '/teams',
    (req, db) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const mine = db.teamMembers.filter((m) => m.user_id === user.user_id)
      const rows = mine.map((m) => db.teams.find((t) => t.team_id === m.team_id)).filter((t): t is MockTeam => Boolean(t))
      return ok(200, rows.map((t) => toTeam(db, t, mine.find((m) => m.team_id === t.team_id)!.role)), { next_cursor: null })
    },
  ],
  [
    // 4.2 팀 생성 — 만든 사람이 owner
    'POST',
    '/teams',
    (req, db) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const b = (req.body ?? {}) as Body
      const name = str(b.name)
      if (!name) return fail(400, 'INVALID_INPUT', '팀 이름을 입력해 주세요.', { field: 'name' })
      if (name.length > 40) return fail(400, 'INVALID_INPUT', '팀 이름은 40자 이하로 정해 주세요.', { field: 'name' })
      const t = stamp()
      const team: MockTeam = { team_id: nextId(db, 'team'), name, description: str(b.description) || null, created_by: user.user_id, created_at: t }
      db.teams.push(team)
      db.teamMembers.push({ team_id: team.team_id, user_id: user.user_id, role: 'owner', joined_at: t })
      return ok(201, toTeam(db, team, 'owner'))
    },
  ],
  [
    'GET',
    '/teams/:teamId',
    (req, db, { teamId }) => {
      const access = requireTeam(req, db, teamId)
      return isResponse(access) ? access : ok(200, toTeam(db, access.team, access.role))
    },
  ],
  [
    // 4.4 팀 정보 수정 — owner·admin
    'PATCH',
    '/teams/:teamId',
    (req, db, { teamId }) => {
      const access = requireTeam(req, db, teamId, 'admin')
      if (isResponse(access)) return access
      const b = (req.body ?? {}) as Body
      if (b.name !== undefined) {
        if (!str(b.name)) return fail(400, 'INVALID_INPUT', '팀 이름을 입력해 주세요.', { field: 'name' })
        access.team.name = str(b.name)
      }
      if (b.description !== undefined) access.team.description = str(b.description) || null
      return ok(200, toTeam(db, access.team, access.role))
    },
  ],
  [
    // 4.5 팀 삭제 — owner만, 팀 프로젝트가 남아 있으면 409
    'DELETE',
    '/teams/:teamId',
    (req, db, { teamId }) => {
      const access = requireTeam(req, db, teamId, 'owner')
      if (isResponse(access)) return access
      const count = teamProjects(db, teamId).length
      if (count > 0) return fail(409, 'TEAM_HAS_ACTIVE_PROJECTS', `진행 중인 팀 프로젝트가 ${count}개 있어요.`, { project_count: count })
      db.teams = db.teams.filter((t) => t.team_id !== teamId)
      db.teamMembers = db.teamMembers.filter((m) => m.team_id !== teamId)
      db.teamInvitations = db.teamInvitations.filter((i) => i.target_id !== teamId)
      return noContent()
    },
  ],
  [
    'GET',
    '/teams/:teamId/members',
    (req, db, { teamId }) => {
      const access = requireTeam(req, db, teamId)
      if (isResponse(access)) return access
      const rows = teamMembers(db, teamId).sort((a, b) => RANK[a.role] - RANK[b.role] || a.joined_at.localeCompare(b.joined_at))
      return ok(200, rows.map((m) => toMember(db, m)), { next_cursor: null })
    },
  ],
  [
    // 4.7 팀원 초대 — owner·admin
    'POST',
    '/teams/:teamId/invitations',
    (req, db, { teamId }) => {
      const access = requireTeam(req, db, teamId, 'admin')
      if (isResponse(access)) return access
      const b = (req.body ?? {}) as Body
      const email = lower(str(b.invited_email))
      const role = str(b.role) || 'member'
      if (!EMAIL.test(email)) return fail(400, 'INVALID_INPUT', '이메일 형식을 확인해 주세요.', { field: 'invited_email' })
      if (role !== 'admin' && role !== 'member') return fail(400, 'INVALID_INPUT', '역할을 골라 주세요.', { field: 'role' })
      const invitee = db.users.find((u) => lower(u.email ?? '') === email)
      if (invitee && teamMembers(db, teamId).some((m) => m.user_id === invitee.user_id)) {
        return fail(409, 'ALREADY_TEAM_MEMBER', '이미 이 팀의 팀원이에요.', { field: 'invited_email' })
      }
      settleInvitations(db.teamInvitations)
      const prev = db.teamInvitations.find((i) => i.target_id === teamId && lower(i.invited_email) === email && (i.status === 'pending' || i.status === 'expired'))
      const inv = newInvitation(db, 'tinv', teamId, email, role, access.user.user_id)
      if (prev) Object.assign(prev, { ...inv, invitation_id: prev.invitation_id })
      else db.teamInvitations.push(inv)
      return ok(201, toInvitation(prev ?? inv), { is_registered: Boolean(invitee) })
    },
  ],
  [
    // 4.8 대기 중인 초대 목록 — owner·admin. Figma 29가 만료된 초대도 보여 주므로 함께 돌려준다
    'GET',
    '/teams/:teamId/invitations',
    (req, db, { teamId }) => {
      const access = requireTeam(req, db, teamId, 'admin')
      if (isResponse(access)) return access
      settleInvitations(db.teamInvitations)
      const rows = db.teamInvitations.filter((i) => i.target_id === teamId && (i.status === 'pending' || i.status === 'expired')).sort((a, b) => b.expires_at.localeCompare(a.expires_at))
      return ok(200, rows.map(toInvitation), { next_cursor: null })
    },
  ],
  [
    // 4.9 초대 수락 — 만료되면 410
    'POST',
    '/teams/:teamId/invitations/:invitationId/accept',
    (req, db, { teamId, invitationId }) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      settleInvitations(db.teamInvitations)
      const inv = db.teamInvitations.find((i) => i.target_id === teamId && i.invitation_id === invitationId && i.status !== 'revoked')
      if (!inv) return fail(404, 'TEAM_INVITATION_NOT_FOUND', '초대를 찾을 수 없어요. 취소되었을 수 있어요.')
      if (lower(inv.invited_email) !== lower(user.email ?? '')) return fail(403, 'FORBIDDEN', '다른 이메일로 보낸 초대예요.')
      if (inv.status === 'expired') return fail(410, 'INVITATION_EXPIRED', '만료된 초대예요. 초대한 사람에게 다시 요청해 주세요.')
      let m = teamMembers(db, teamId).find((x) => x.user_id === user.user_id)
      if (!m) {
        m = { team_id: teamId, user_id: user.user_id, role: inv.role as TeamRole, joined_at: stamp() }
        db.teamMembers.push(m)
      }
      inv.status = 'accepted'
      return ok(200, toMember(db, m))
    },
  ],
  [
    // 4.10 초대 취소 → revoked
    'DELETE',
    '/teams/:teamId/invitations/:invitationId',
    (req, db, { teamId, invitationId }) => {
      const access = requireTeam(req, db, teamId, 'admin')
      if (isResponse(access)) return access
      const inv = db.teamInvitations.find((i) => i.target_id === teamId && i.invitation_id === invitationId)
      if (!inv) return fail(404, 'TEAM_INVITATION_NOT_FOUND', '초대를 찾을 수 없어요.')
      inv.status = 'revoked'
      return noContent()
    },
  ],
  [
    // 4.11 팀원 역할 변경 — 목업에서는 owner만 (소유자 지정 포함)
    'PATCH',
    '/teams/:teamId/members/:userId',
    (req, db, { teamId, userId }) => {
      const access = requireTeam(req, db, teamId, 'owner')
      if (isResponse(access)) return access
      const m = teamMembers(db, teamId).find((x) => x.user_id === userId)
      if (!m) return fail(404, 'TEAM_MEMBER_NOT_FOUND', '팀원을 찾을 수 없어요.')
      const role = str((req.body as Body)?.role) as TeamRole
      if (!ROLES.includes(role)) return fail(400, 'INVALID_INPUT', '역할을 골라 주세요.', { field: 'role' })
      if (role !== 'owner' && isLastOwner(db, teamId, userId)) {
        return fail(409, 'LAST_OWNER_CANNOT_LEAVE', '팀에 소유자가 한 명은 있어야 해요. 다른 팀원에게 먼저 소유자 역할을 넘겨 주세요.')
      }
      m.role = role
      return ok(200, toMember(db, m))
    },
  ],
  [
    // 4.12 팀원 제거 / 팀 탈퇴 — 본인, 또는 owner·admin (admin은 owner를 내보낼 수 없음)
    'DELETE',
    '/teams/:teamId/members/:userId',
    (req, db, { teamId, userId }) => {
      const access = requireTeam(req, db, teamId)
      if (isResponse(access)) return access
      const m = teamMembers(db, teamId).find((x) => x.user_id === userId)
      if (!m) return fail(404, 'TEAM_MEMBER_NOT_FOUND', '팀원을 찾을 수 없어요.')
      const self = userId === access.user.user_id
      if (!self && (access.role === 'member' || (access.role === 'admin' && m.role !== 'member'))) {
        return fail(403, 'FORBIDDEN', '이 팀원을 내보낼 권한이 없어요.')
      }
      if (isLastOwner(db, teamId, userId)) return fail(409, 'LAST_OWNER_CANNOT_LEAVE', '팀 소유자는 나갈 수 없어요. 먼저 다른 팀원에게 소유자 역할을 넘겨 주세요.')
      db.teamMembers = db.teamMembers.filter((x) => x !== m)
      return noContent()
    },
  ],
  [
    // 4.13 팀 소속 프로젝트 목록
    'GET',
    '/teams/:teamId/projects',
    (req, db, { teamId }) => {
      const access = requireTeam(req, db, teamId)
      if (isResponse(access)) return access
      const rows = teamProjects(db, teamId).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      return ok(200, rows.map((p) => toProject(db, p, access.user.user_id)), { next_cursor: null })
    },
  ],
]
