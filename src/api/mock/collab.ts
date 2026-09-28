import type { MockDb, MockInvitation, MockNotification, MockUser } from './db'

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
  return seedNotifications(db)
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

/**
 * Figma 30 · 알림의 예시. writer_kim이 받은 초대 두 건(안 읽음)과 지난 소식 세 건.
 * 초대를 실제로 수락할 수 있도록 이형민의 팀 "밤의 서재", 박서연의 프로젝트 "푸른 등대"를 함께 만든다.
 */
export function seedNotifications(db: MockDb): MockDb {
  db.notifications = []
  db.notificationSettings = {}
  db.emailIntegrations = []
  const kim = db.users.find((u) => u.user_id === 'user_101')
  if (!kim?.email) return db
  // 다시 채울 때(시연 초기화) 앞서 수락한 초대와 멤버십을 되돌린다
  db.teamInvitations = db.teamInvitations.filter((i) => i.invitation_id !== 'tinv_4')
  db.projectInvitations = db.projectInvitations.filter((i) => i.invitation_id !== 'pinv_4')
  db.teamMembers = db.teamMembers.filter((m) => !(m.team_id === 'team_11' && m.user_id === 'user_101'))
  db.projectMembers = db.projectMembers.filter((m) => !(m.project_id === 'proj_9' && m.user_id === 'user_101'))

  if (!db.teams.some((t) => t.team_id === 'team_11')) {
    db.teams.push({ team_id: 'team_11', name: '밤의 서재', description: '장르 단편을 돌려 읽는 모임', created_by: 'user_150', created_at: at('2026-09-05') })
    db.teamMembers.push({ team_id: 'team_11', user_id: 'user_150', role: 'owner', joined_at: at('2026-09-05') })
  }
  const teamInv = invite('tinv_4', 'team_11', kim.email, 'member', 'user_150', 6)
  db.teamInvitations.push(teamInv)

  if (!db.projects.some((p) => p.project_id === 'proj_9')) {
    const t = hoursAgo(30)
    db.projects.push({ project_id: 'proj_9', title: '푸른 등대', description: '외딴섬 등대지기의 마지막 여름', owner_type: 'personal', team_id: null, created_by: 'user_151', created_at: t, updated_at: t })
    db.projectMembers.push({ project_id: 'proj_9', user_id: 'user_151', role: 'owner', joined_at: t })
    db.worlds.proj_9 = { characters: [], relationships: [], conflicts: [], foreshadowings: [], story: null, rules: [] }
  }
  const projectInv = { ...invite('pinv_4', 'proj_9', kim.email, 'editor', 'user_151', 7), created_at: hoursAgo(1) }
  db.projectInvitations.push(projectInv)

  const n = (id: string, type: MockNotification['type'], title: string, body: string, hours: number, read: boolean, related_ref: MockNotification['related_ref'] = null): MockNotification => ({
    notification_id: id,
    user_id: 'user_101',
    type,
    title,
    body,
    related_ref,
    channels_sent: ['in_app', 'email'],
    read_at: read ? hoursAgo(hours - 0.1) : null,
    created_at: hoursAgo(hours),
  })
  db.notifications.push(
    n('noti_1', 'team_invite', '팀 초대', '이형민 님이 밤의 서재 팀에 초대했어요', 20, false, { type: 'team_invitation', id: teamInv.invitation_id, parent_id: 'team_11' }),
    n('noti_2', 'project_invite', '프로젝트 초대', '박서연 님이 푸른 등대에 편집자로 초대했어요', 1, false, { type: 'project_invitation', id: projectInv.invitation_id, parent_id: 'proj_9' }),
    n('noti_3', 'mention', '멘션', '정다은 님이 27장 메모에서 회원님을 언급했어요', 26, true, { type: 'project', id: 'proj_1' }),
    n('noti_4', 'team_joined', '팀 합류', '정다은 님이 문장 수집소 팀에 합류했어요', 72, true, { type: 'team', id: 'team_10' }),
    n('noti_5', 'system', '시스템', 'Gmail 계정 연동이 완료됐어요', 24 * 7, true),
  )
  db.emailIntegrations.push({ integration_id: 'eint_1', user_id: 'user_101', provider: 'gmail', email_address: 'yujin.kim@gmail.com', connected_at: at('2026-08-30') })
  return db
}
