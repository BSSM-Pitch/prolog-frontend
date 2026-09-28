import type { ProjectInvitation, ProjectMember, ProjectRole } from '../../types'
import { requireProject, touchProject } from '../access'
import type { MockDb, MockInvitation, MockProjectMember } from '../db'
import { authenticate, fail, isResponse, lower, nextId, noContent, ok, stamp, str, type Body, type Route } from '../http'

const DAY = 86_400_000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RANK: Record<ProjectRole, number> = { owner: 0, editor: 1, viewer: 2 }

/** 기한이 지난 대기 초대를 만료로 바꾼다 (프로젝트·팀 초대 공통) */
export function settleInvitations(rows: MockInvitation[]) {
  for (const i of rows) if (i.status === 'pending' && new Date(i.expires_at).getTime() <= Date.now()) i.status = 'expired'
}

export function newInvitation(db: MockDb, prefix: string, target_id: string, invited_email: string, role: string, invited_by: string): MockInvitation {
  const now = Date.now()
  return { invitation_id: nextId(db, prefix), target_id, invited_email, role, status: 'pending', invited_by, created_at: stamp(), expires_at: new Date(now + 7 * DAY).toISOString() }
}

function toMember(db: MockDb, m: MockProjectMember): ProjectMember {
  const u = db.users.find((x) => x.user_id === m.user_id)
  return { project_id: m.project_id, user_id: m.user_id, role: m.role, joined_at: m.joined_at ?? stamp(), name: u?.name ?? u?.username ?? '알 수 없는 사용자', email: u?.email ?? null }
}

function toInvitation(i: MockInvitation): ProjectInvitation {
  return { invitation_id: i.invitation_id, project_id: i.target_id, invited_email: i.invited_email, role: i.role as ProjectInvitation['role'], status: i.status, created_at: i.created_at, expires_at: i.expires_at }
}

const members = (db: MockDb, projectId: string) => db.projectMembers.filter((m) => m.project_id === projectId)
const isLastOwner = (db: MockDb, projectId: string, userId: string) => {
  const owners = members(db, projectId).filter((m) => m.role === 'owner')
  return owners.length === 1 && owners[0].user_id === userId
}

// PRJ 4.6 ~ 4.11 멤버와 초대
export const memberRoutes: Route[] = [
  [
    'GET',
    '/projects/:projectId/members',
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      const rows = members(db, projectId).sort((a, b) => RANK[a.role] - RANK[b.role] || (a.joined_at ?? '').localeCompare(b.joined_at ?? ''))
      return ok(200, rows.map((m) => toMember(db, m)), { next_cursor: null })
    },
  ],
  [
    // (명세 미정의) Figma 28 "보낸 초대" 목록. 취소한 초대는 보이지 않는다
    'GET',
    '/projects/:projectId/invitations',
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      settleInvitations(db.projectInvitations)
      const rows = db.projectInvitations.filter((i) => i.target_id === projectId && i.status !== 'revoked').sort((a, b) => b.created_at.localeCompare(a.created_at))
      return ok(200, rows.map(toInvitation), { next_cursor: null })
    },
  ],
  [
    // 4.7 공동 작업자 초대 — owner·editor
    'POST',
    '/projects/:projectId/invitations',
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const b = (req.body ?? {}) as Body
      const email = lower(str(b.invited_email))
      const role = str(b.role)
      if (!EMAIL.test(email)) return fail(400, 'INVALID_INPUT', '이메일 형식을 확인해 주세요.', { field: 'invited_email' })
      if (role !== 'editor' && role !== 'viewer') return fail(400, 'INVALID_INPUT', '역할을 골라 주세요.', { field: 'role' })
      const invitee = db.users.find((u) => lower(u.email ?? '') === email)
      if (invitee && members(db, projectId).some((m) => m.user_id === invitee.user_id)) {
        return fail(409, 'ALREADY_MEMBER', '이미 이 프로젝트에 참여하고 있는 사람이에요.', { field: 'invited_email' })
      }
      settleInvitations(db.projectInvitations)
      // 같은 이메일로 보낸 초대가 대기·만료 상태면 새로 보내는 대신 기한을 다시 7일로 늘린다 (목업)
      const prev = db.projectInvitations.find((i) => i.target_id === projectId && lower(i.invited_email) === email && i.status !== 'accepted')
      const inv = newInvitation(db, 'pinv', projectId, email, role, access.user.user_id)
      if (prev) Object.assign(prev, { ...inv, invitation_id: prev.invitation_id })
      else db.projectInvitations.push(inv)
      touchProject(db, projectId)
      return ok(201, toInvitation(prev ?? inv), { is_registered: Boolean(invitee) })
    },
  ],
  [
    // 4.8 초대 수락 — 초대받은 이메일로 로그인한 사람만 (명세 미정의 규칙)
    'POST',
    '/projects/:projectId/invitations/:invitationId/accept',
    (req, db, { projectId, invitationId }) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      settleInvitations(db.projectInvitations)
      const inv = db.projectInvitations.find((i) => i.target_id === projectId && i.invitation_id === invitationId && i.status !== 'revoked')
      if (!inv) return fail(404, 'INVITATION_NOT_FOUND', '초대를 찾을 수 없어요. 취소되었을 수 있어요.')
      if (lower(inv.invited_email) !== lower(user.email ?? '')) return fail(403, 'FORBIDDEN', '다른 이메일로 보낸 초대예요.')
      if (inv.status === 'expired') return fail(410, 'INVITATION_EXPIRED', '만료된 초대예요. 초대한 사람에게 다시 요청해 주세요.')
      if (!members(db, projectId).some((m) => m.user_id === user.user_id)) {
        db.projectMembers.push({ project_id: projectId, user_id: user.user_id, role: inv.role as ProjectRole, joined_at: stamp() })
      }
      inv.status = 'accepted'
      const m = members(db, projectId).find((x) => x.user_id === user.user_id)!
      return ok(200, toMember(db, m))
    },
  ],
  [
    // 4.9 초대 취소
    'DELETE',
    '/projects/:projectId/invitations/:invitationId',
    (req, db, { projectId, invitationId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const inv = db.projectInvitations.find((i) => i.target_id === projectId && i.invitation_id === invitationId)
      if (!inv) return fail(404, 'INVITATION_NOT_FOUND', '초대를 찾을 수 없어요.')
      inv.status = 'revoked'
      return noContent()
    },
  ],
  [
    // 4.10 멤버 역할 변경 — 목업에서는 owner만
    'PATCH',
    '/projects/:projectId/members/:userId',
    (req, db, { projectId, userId }) => {
      const access = requireProject(req, db, projectId, 'owner')
      if (isResponse(access)) return access
      const m = members(db, projectId).find((x) => x.user_id === userId)
      if (!m) return fail(404, 'MEMBER_NOT_FOUND', '멤버를 찾을 수 없어요.')
      const role = str((req.body as Body)?.role) as ProjectRole
      if (!(role in RANK)) return fail(400, 'INVALID_INPUT', '역할을 골라 주세요.', { field: 'role' })
      if (role !== 'owner' && isLastOwner(db, projectId, userId)) {
        return fail(409, 'LAST_OWNER_CANNOT_LEAVE', '프로젝트에 소유자가 한 명은 있어야 해요. 다른 멤버에게 먼저 소유자 역할을 넘겨 주세요.')
      }
      m.role = role
      touchProject(db, projectId)
      return ok(200, toMember(db, m))
    },
  ],
  [
    // 4.11 멤버 제거 / 프로젝트 나가기
    'DELETE',
    '/projects/:projectId/members/:userId',
    (req, db, { projectId, userId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      const self = userId === access.user.user_id
      if (!self && access.role !== 'owner') return fail(403, 'FORBIDDEN', '소유자만 멤버를 내보낼 수 있어요.')
      const m = members(db, projectId).find((x) => x.user_id === userId)
      if (!m) return fail(404, 'MEMBER_NOT_FOUND', '멤버를 찾을 수 없어요.')
      if (isLastOwner(db, projectId, userId)) {
        return fail(409, 'LAST_OWNER_CANNOT_LEAVE', '프로젝트 소유자는 나갈 수 없어요. 먼저 다른 멤버에게 소유자 역할을 넘겨 주세요.')
      }
      db.projectMembers = db.projectMembers.filter((x) => x !== m)
      touchProject(db, projectId)
      return noContent()
    },
  ],
]
