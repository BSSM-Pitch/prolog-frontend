import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import * as api from '../../api/teams'
import type { TeamInvitation, TeamMember, TeamRole } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { describeError } from '../../lib/errors'
import { shortDate } from '../../lib/relativeTime'
import { TEAM_ROLE_LABEL } from '../../lib/roles'
import { useResource } from '../../lib/useResource'
import '../characters/characters.css'
import '../projects/members.css'
import '../world/world.css'
import { TeamInviteForm } from './TeamInviteForm'
import { notifyTeamsChanged } from './teamEvents'
import './teams.css'

const DAY = 86_400_000
const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY))

type Pending = { kind: 'leave' | 'remove'; member: TeamMember } | { kind: 'delete' } | null

// Figma 1260:2672 · 29 팀원과 초대
export function TeamMembersPage() {
  const { teamId = '' } = useParams()
  const navigate = useNavigate()
  const { user, withAuth } = useSession()
  const team = useResource((t) => api.getTeam(t, teamId), [teamId])
  const members = useResource((t) => api.listTeamMembers(t, teamId), [teamId])
  const manage = team.data ? team.data.my_role !== 'member' : false
  const invitations = useResource(manage ? (t) => api.listTeamInvitations(t, teamId) : null, [teamId, manage])

  const [inviting, setInviting] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState<{ title: string; body: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const t = team.data
  if (team.error && !t) {
    return (
      <div className="panel" role="alert">
        <p className="panel__title">팀을 열 수 없어요</p>
        <p className="page-desc">{team.error}</p>
      </div>
    )
  }
  if (!t) return <p className="page-desc">팀을 불러오고 있어요</p>
  const isOwner = t.my_role === 'owner'
  const list = members.data ?? []

  async function run<T>(fn: (token: string) => Promise<T>) {
    setError(null)
    setBlocked(null)
    try {
      return await withAuth(fn)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'LAST_OWNER_CANNOT_LEAVE') setBlocked({ title: '팀 소유자는 나갈 수 없어요', body: '먼저 다른 팀원에게 소유자 역할을 넘겨 주세요.' })
      else if (e instanceof ApiError && e.code === 'TEAM_HAS_ACTIVE_PROJECTS') setBlocked({ title: e.message, body: '프로젝트를 옮기거나 삭제한 뒤 팀을 삭제할 수 있어요.' })
      else setError(describeError(e))
      return undefined
    }
  }

  // admin은 멤버만, owner는 누구든 내보낼 수 있다 (TEAM 4.12)
  const canRemove = (m: TeamMember) => t.my_role === 'owner' || (t.my_role === 'admin' && m.role === 'member')

  async function changeRole(m: TeamMember, role: TeamRole) {
    const updated = await run((tk) => api.changeTeamRole(tk, teamId, m.user_id, role))
    if (updated) members.setData((prev) => prev?.map((x) => (x.user_id === updated.user_id ? updated : x)) ?? prev)
  }

  async function confirmPending() {
    if (!pending) return
    setBusy(true)
    const p = pending
    const done = await run((tk) => (p.kind === 'delete' ? api.deleteTeam(tk, teamId) : api.removeTeamMember(tk, teamId, p.member.user_id)))
    setBusy(false)
    setPending(null)
    if (done === undefined) return
    if (p.kind === 'remove') {
      members.setData((prev) => prev?.filter((x) => x.user_id !== p.member.user_id) ?? prev)
      team.reload()
      return
    }
    notifyTeamsChanged()
    navigate('/projects', { replace: true })
  }

  const invites = invitations.data ?? []
  const waiting = invites.filter((i) => i.status === 'pending').length

  return (
    <div className="members">
      <header className="world__header">
        <div>
          <p className="page-crumb">
            관리 / <Link to={`/teams/${teamId}`}>{t.name}</Link>
          </p>
          <h1 className="page-title">팀원과 초대</h1>
          <p className="page-desc">팀원 역할을 관리하고 대기 중인 초대를 확인하세요. 초대는 7일 뒤 만료돼요.</p>
        </div>
        {manage && (
          <Button tone={inviting ? 'outline' : 'primary'} onClick={() => setInviting((v) => !v)} aria-expanded={inviting}>
            {inviting ? '닫기' : '+ 팀원 초대'}
          </Button>
        )}
      </header>

      {inviting && (
        <section className="panel" aria-label="팀원 초대">
          <TeamInviteForm
            teamId={teamId}
            layout="inline"
            autoFocus
            onInvited={(inv) => {
              invitations.setData((prev) => [inv, ...(prev ?? []).filter((x) => x.invitation_id !== inv.invitation_id)])
              team.reload()
            }}
          />
        </section>
      )}

      {blocked && (
        <div className="notice notice--error members__alert" role="alert">
          <strong>{blocked.title}</strong>
          <span>{blocked.body}</span>
        </div>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      <div className="members__layout">
        <section className="panel" aria-labelledby="team-members-title">
          <h2 id="team-members-title" className="panel__title">
            팀원 {list.length}명
          </h2>
          <table className="members__table">
            <thead>
              <tr>
                <th scope="col">이름</th>
                <th scope="col">역할</th>
                <th scope="col">합류일</th>
                <th scope="col">
                  <span className="visually-hidden">작업</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => {
                const me = m.user_id === user?.user_id
                return (
                  <tr key={m.user_id}>
                    <td>
                      <span className="members__name">
                        {m.name}
                        {me && ' (나)'}
                      </span>
                      {m.email && <span className="members__email">{m.email}</span>}
                    </td>
                    <td>
                      {isOwner && !me ? (
                        <select className="nl-select members__role" value={m.role} onChange={(e) => changeRole(m, e.target.value as TeamRole)} aria-label={`${m.name}의 역할`}>
                          {(Object.keys(TEAM_ROLE_LABEL) as TeamRole[]).map((r) => (
                            <option key={r} value={r}>
                              {TEAM_ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={m.role === 'owner' ? 'badge badge--done' : 'badge badge--filled'}>{TEAM_ROLE_LABEL[m.role]}</span>
                      )}
                    </td>
                    <td>{shortDate(m.joined_at)}</td>
                    <td className="members__action">
                      {me ? (
                        <Button tone="outline" onClick={() => setPending({ kind: 'leave', member: m })}>
                          나가기
                        </Button>
                      ) : (
                        canRemove(m) && (
                          <Button tone="outline" onClick={() => setPending({ kind: 'remove', member: m })}>
                            내보내기
                          </Button>
                        )
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="panel__label">관리자는 팀 정보를 고치고 팀원을 초대·내보낼 수 있어요. 소유자만 팀을 삭제할 수 있어요.</p>
        </section>

        <div className="members__side">
          {manage && (
            <section className="panel" aria-labelledby="waiting-title">
              <h2 id="waiting-title" className="panel__title">
                대기 중인 초대 {waiting}건
              </h2>
              {invites.length === 0 && <p className="page-desc">대기 중인 초대가 없어요.</p>}
              <ul className="members__invites">
                {invites.map((i) => (
                  <InviteRow
                    key={i.invitation_id}
                    invitation={i}
                    onCancel={async () => {
                      const done = await run((tk) => api.cancelTeamInvitation(tk, teamId, i.invitation_id))
                      if (done !== undefined) {
                        invitations.setData((prev) => prev?.filter((x) => x.invitation_id !== i.invitation_id) ?? prev)
                        team.reload()
                      }
                    }}
                    onResend={async () => {
                      const res = await run((tk) => api.inviteToTeam(tk, teamId, { invited_email: i.invited_email, role: i.role }))
                      if (res) invitations.setData((prev) => prev?.map((x) => (x.invitation_id === i.invitation_id ? res.data : x)) ?? prev)
                    }}
                  />
                ))}
              </ul>
            </section>
          )}

          {isOwner && (
            <section className="panel members__danger" aria-labelledby="danger-title">
              <h2 id="danger-title" className="panel__title">
                팀 삭제
              </h2>
              <p className="page-desc">팀을 삭제하면 팀원과 초대 기록이 함께 사라져요.</p>
              {t.project_count > 0 && (
                <div className="notice notice--error members__alert">
                  <strong>진행 중인 팀 프로젝트가 {t.project_count}개 있어요</strong>
                  <span>프로젝트를 옮기거나 삭제한 뒤 팀을 삭제할 수 있어요.</span>
                </div>
              )}
              <Button tone="error" disabled={t.project_count > 0} onClick={() => setPending({ kind: 'delete' })}>
                팀 삭제
              </Button>
            </section>
          )}
        </div>
      </div>

      {pending && (
        <ConfirmDialog
          title={pending.kind === 'delete' ? `“${t.name}” 팀을 삭제할까요?` : pending.kind === 'leave' ? `“${t.name}” 팀에서 나갈까요?` : `${pending.member.name} 님을 내보낼까요?`}
          body={
            pending.kind === 'delete'
              ? '팀원과 초대 기록이 함께 사라지고 되돌릴 수 없어요.'
              : pending.kind === 'leave'
                ? '다시 합류하려면 초대를 받아야 해요.'
                : '내보내면 팀 작업공간에 더 들어올 수 없어요.'
          }
          confirmLabel={pending.kind === 'delete' ? '팀 삭제' : pending.kind === 'leave' ? '나가기' : '내보내기'}
          busy={busy}
          onConfirm={confirmPending}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

function InviteRow({ invitation: i, onCancel, onResend }: { invitation: TeamInvitation; onCancel: () => Promise<void>; onResend: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const act = (fn: () => Promise<void>) => async () => {
    setBusy(true)
    await fn()
    setBusy(false)
  }
  return (
    <li className="members__invite">
      <span className="members__invite-email">
        {i.invited_email}
        <span className="members__email">{TEAM_ROLE_LABEL[i.role]}</span>
      </span>
      {i.status === 'pending' ? (
        <>
          <span className="badge badge--waiting">{daysLeft(i.expires_at)}일 남음</span>
          <Button tone="outline" onClick={act(onCancel)} busy={busy}>
            초대 취소
          </Button>
        </>
      ) : (
        <>
          <span className="badge badge--filled">만료됨</span>
          <Button tone="soft" onClick={act(onResend)} busy={busy}>
            다시 초대
          </Button>
        </>
      )}
    </li>
  )
}
