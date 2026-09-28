import type { MockDb, MockInvitation, MockUser } from './db'

// 협업 화면(Figma 26·28·29·30)의 예시 사람과 초대. writer_kim(김유진)을 기준으로 만든다.
// 예시 팀원도 같은 비밀번호로 로그인해 볼 수 있다 — 목업 전용.

const at = (date: string) => new Date(`${date}T10:00:00+09:00`).toISOString()
const DAY = 86_400_000

function person(user_id: string, username: string, name: string, email: string): MockUser {
  return {
    user_id,
    username,
    name,
    email,
    password: 'prolog1234',
    role: 'writer',
    auth_provider: 'local',
    provider_user_id: null,
    created_at: at('2026-08-01'),
    updated_at: at('2026-08-01'),
  }
}

export const DEMO_PEOPLE: MockUser[] = [
  person('user_150', 'hm_lee', '이형민', 'hm.lee@gmail.com'),
  person('user_151', 'seoyeon', '박서연', 'seoyeon@gmail.com'),
  person('user_152', 'daeun', '정다은', 'daeun@gmail.com'),
]

/** 초대 한 건. daysLeft가 0 이하이면 만료된 초대 */
function invite(id: string, target_id: string, invited_email: string, role: string, invited_by: string, daysLeft: number, status: MockInvitation['status'] = 'pending'): MockInvitation {
  const expires = Date.now() + daysLeft * DAY - 60_000
  return {
    invitation_id: id,
    target_id,
    invited_email,
    role,
    status: daysLeft <= 0 && status === 'pending' ? 'expired' : status,
    invited_by,
    created_at: new Date(expires - 7 * DAY).toISOString(),
    expires_at: new Date(expires).toISOString(),
  }
}

/** 시드와 예전 저장본 모두에 쓴다. 이미 있는 계정·멤버십은 건드리지 않는다 */
export function seedCollaboration(db: MockDb): MockDb {
  for (const p of DEMO_PEOPLE) if (!db.users.some((u) => u.user_id === p.user_id)) db.users.push({ ...p })

  const team = db.teams.find((t) => t.team_id === 'team_10')
  if (team) Object.assign(team, { description: team.description ?? '미스터리 장편을 함께 기획하고 집필하는 창작팀', created_by: 'user_101', created_at: at('2026-08-10') })

  db.teamMembers = team
    ? [
        { team_id: 'team_10', user_id: 'user_101', role: 'owner', joined_at: at('2026-08-10') },
        { team_id: 'team_10', user_id: 'user_150', role: 'admin', joined_at: at('2026-08-11') },
        { team_id: 'team_10', user_id: 'user_151', role: 'member', joined_at: at('2026-08-18') },
        { team_id: 'team_10', user_id: 'user_152', role: 'member', joined_at: at('2026-09-01') },
      ]
    : []
  db.teamInvitations = team
    ? [
        invite('tinv_1', 'team_10', 'writer3@example.com', 'member', 'user_101', 6),
        invite('tinv_2', 'team_10', 'editor@example.com', 'member', 'user_150', 2),
        invite('tinv_3', 'team_10', 'past@example.com', 'member', 'user_101', -3),
      ]
    : []

  // 붉은 문 너머(proj_1)의 공동 작업자. 다른 팀 프로젝트는 이형민이 소유자
  const joined: Record<string, string> = { user_101: '2026-08-12', user_150: '2026-08-14', user_151: '2026-08-20', user_152: '2026-09-02' }
  const add = (project_id: string, user_id: string, role: 'owner' | 'editor' | 'viewer') => {
    if (!db.projects.some((p) => p.project_id === project_id)) return
    if (db.projectMembers.some((m) => m.project_id === project_id && m.user_id === user_id)) return
    const created = db.projects.find((p) => p.project_id === project_id)?.created_at
    db.projectMembers.push({ project_id, user_id, role, joined_at: project_id === 'proj_1' ? at(joined[user_id] ?? '2026-08-12') : created })
  }
  add('proj_1', 'user_150', 'editor')
  add('proj_1', 'user_151', 'editor')
  add('proj_1', 'user_152', 'viewer')
  for (const id of ['proj_2', 'proj_3', 'proj_6']) add(id, 'user_150', 'owner')
  for (const m of db.projectMembers) m.joined_at ??= m.project_id === 'proj_1' ? at(joined[m.user_id] ?? '2026-08-12') : db.projects.find((p) => p.project_id === m.project_id)?.created_at

  db.projectInvitations = db.projects.some((p) => p.project_id === 'proj_1')
    ? [
        invite('pinv_1', 'proj_1', 'writer2@example.com', 'editor', 'user_101', 6),
        invite('pinv_2', 'proj_1', 'friend@example.com', 'viewer', 'user_101', 4, 'accepted'),
        invite('pinv_3', 'proj_1', 'old@example.com', 'editor', 'user_101', -2),
      ]
    : []
  return db
}
