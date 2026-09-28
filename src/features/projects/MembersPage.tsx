import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import * as api from '../../api/members'
import type { InvitationStatus, ProjectInvitation, ProjectMember, ProjectRole } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { TextField } from '../../components/TextField'
import { describeError } from '../../lib/errors'
import { shortDate } from '../../lib/relativeTime'
import { PROJECT_ROLE_LABEL } from '../../lib/roles'
import { useResource } from '../../lib/useResource'
import { EMAIL_RULE } from '../../lib/validation'
import { useCurrentProject, useProject } from '../app/currentProject'
import '../characters/characters.css'
import '../world/world.css'
import './members.css'

const STATUS: Record<InvitationStatus, { label: string; badge: string }> = {
  pending: { label: '대기 중', badge: 'badge--waiting' },
  accepted: { label: '수락됨', badge: 'badge--success' },
  expired: { label: '만료됨', badge: 'badge--filled' },
  revoked: { label: '취소됨', badge: 'badge--filled' },
}

type Pending = { kind: 'leave' | 'remove'; member: ProjectMember } | null

// Figma 1260:2438 · 28 프로젝트 멤버
export function MembersPage() {
  const project = useProject()
  const { reload: reloadProject } = useCurrentProject()
  const navigate = useNavigate()
  const { user, withAuth } = useSession()
  const projectId = project?.project_id ?? ''
  const canInvite = project?.my_role === 'owner' || project?.my_role === 'editor'
  const isOwner = project?.my_role === 'owner'

  const members = useResource(project ? (t) => api.listMembers(t, projectId) : null, [projectId])
  const invitations = useResource(project && canInvite ? (t) => api.listInvitations(t, projectId) : null, [projectId, canInvite])

  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>

  async function run<T>(fn: (t: string) => Promise<T>) {
    setError(null)
    setBlocked(null)
    try {
      return await withAuth(fn)
    } catch (e) {
      // 유일한 소유자가 나가거나 강등하려 하면 Figma 28의 경고로 안내한다
      if (e instanceof ApiError && e.code === 'LAST_OWNER_CANNOT_LEAVE') setBlocked(e.message)
      else setError(describeError(e))
      return undefined
    }
  }

  async function changeRole(m: ProjectMember, role: ProjectRole) {
    const updated = await run((t) => api.changeRole(t, projectId, m.user_id, role))
    if (!updated) return
    members.setData((prev) => prev?.map((x) => (x.user_id === updated.user_id ? updated : x)) ?? prev)
    if (updated.user_id === user?.user_id) reloadProject()
  }

  async function confirmPending() {
    if (!pending) return
    setBusy(true)
    const done = await run((t) => api.removeMember(t, projectId, pending.member.user_id))
    setBusy(false)
    const leaving = pending.kind === 'leave'
    setPending(null)
    if (done === undefined) return
    if (leaving) navigate('/projects', { replace: true })
    else members.setData((prev) => prev?.filter((x) => x.user_id !== pending.member.user_id) ?? prev)
  }

  const list = members.data ?? []

  return (
    <div className="members">
      <header className="world__header">
        <div>
          <p className="page-crumb">{project.title} / 설정</p>
          <h1 className="page-title">프로젝트 멤버</h1>
          <p className="page-desc">함께 작업할 사람을 초대하고 역할을 정하세요.</p>
        </div>
      </header>

      {blocked && (
        <div className="notice notice--error members__alert" role="alert">
          <strong>프로젝트 소유자는 나갈 수 없어요</strong>
          <span>{blocked.includes('넘겨') ? '먼저 다른 멤버에게 소유자 역할을 넘겨 주세요.' : blocked}</span>
        </div>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      <div className="members__layout">
        <section className="panel" aria-labelledby="members-title">
          <h2 id="members-title" className="panel__title">
            멤버 {list.length}명
          </h2>
          {members.error && !members.data && <p className="notice notice--error">{members.error}</p>}
          <table className="members__table">
            <thead>
              <tr>
                <th scope="col">이름</th>
                <th scope="col">역할</th>
                <th scope="col">참여일</th>
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
                        <select className="nl-select members__role" value={m.role} onChange={(e) => changeRole(m, e.target.value as ProjectRole)} aria-label={`${m.name}의 역할`}>
                          {(Object.keys(PROJECT_ROLE_LABEL) as ProjectRole[]).map((r) => (
                            <option key={r} value={r}>
                              {PROJECT_ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={m.role === 'owner' ? 'badge badge--done' : 'badge badge--filled'}>{PROJECT_ROLE_LABEL[m.role]}</span>
                      )}
                    </td>
                    <td>{shortDate(m.joined_at)}</td>
                    <td className="members__action">
                      {me ? (
                        <Button tone="outline" onClick={() => setPending({ kind: 'leave', member: m })}>
                          나가기
                        </Button>
                      ) : (
                        isOwner && (
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
        </section>

        <div className="members__side">
          {canInvite ? (
            <InviteForm
              projectId={projectId}
              onInvited={(inv) =>
                invitations.setData((prev) => {
                  const rest = (prev ?? []).filter((x) => x.invitation_id !== inv.invitation_id)
                  return [inv, ...rest]
                })
              }
            />
          ) : (
            <section className="panel">
              <h2 className="panel__title">초대하기</h2>
              <p className="page-desc">보기 전용 멤버는 다른 사람을 초대할 수 없어요. 소유자나 편집자에게 요청해 주세요.</p>
            </section>
          )}

          {canInvite && (
            <section className="panel" aria-labelledby="sent-title">
              <h2 id="sent-title" className="panel__title">
                보낸 초대
              </h2>
              {(invitations.data ?? []).length === 0 && <p className="page-desc">아직 보낸 초대가 없어요.</p>}
              <ul className="members__invites">
                {(invitations.data ?? []).map((i) => (
                  <InvitationRow
                    key={i.invitation_id}
                    invitation={i}
                    onCancel={async () => {
                      const done = await run((t) => api.cancelInvitation(t, projectId, i.invitation_id))
                      if (done !== undefined) invitations.setData((prev) => prev?.filter((x) => x.invitation_id !== i.invitation_id) ?? prev)
                    }}
                    onResend={async () => {
                      const res = await run((t) => api.invite(t, projectId, { invited_email: i.invited_email, role: i.role }))
                      if (res) invitations.setData((prev) => prev?.map((x) => (x.invitation_id === i.invitation_id ? res.data : x)) ?? prev)
                    }}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {pending && (
        <ConfirmDialog
          title={pending.kind === 'leave' ? `“${project.title}”에서 나갈까요?` : `${pending.member.name} 님을 내보낼까요?`}
          body={
            pending.kind === 'leave'
              ? '나가면 이 프로젝트의 원고와 분석 결과를 더 볼 수 없어요. 다시 참여하려면 초대를 받아야 해요.'
              : '내보내면 이 프로젝트에 더 들어올 수 없어요. 쓴 원고와 기록은 그대로 남아요.'
          }
          confirmLabel={pending.kind === 'leave' ? '나가기' : '내보내기'}
          busy={busy}
          onConfirm={confirmPending}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

function InviteForm({ projectId, onInvited }: { projectId: string; onInvited: (inv: ProjectInvitation) => void }) {
  const { withAuth } = useSession()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ProjectInvitation['role']>('editor')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSent(null)
    const value = email.trim()
    if (!EMAIL_RULE.test(value)) return setError('이메일 형식을 확인해 주세요.')
    setBusy(true)
    try {
      const res = await withAuth((t) => api.invite(t, projectId, { invited_email: value, role }))
      onInvited(res.data)
      setSent(res.meta.is_registered === false ? `${value}에 회원가입 안내와 함께 초대를 보냈어요.` : `${value}에 초대를 보냈어요.`)
      setEmail('')
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="invite-title">
      <h2 id="invite-title" className="panel__title">
        초대하기
      </h2>
      <form className="members__form" onSubmit={submit} noValidate>
        <TextField
          label="이메일"
          type="email"
          value={email}
          onChange={(v) => {
            setEmail(v)
            setError(null)
          }}
          placeholder="co-writer@example.com"
          error={error}
          success={sent}
          autoComplete="off"
        />
        <fieldset className="members__roles">
          <legend className="field__label">역할</legend>
          <div className="segmented segmented--wide" role="radiogroup">
            {(['editor', 'viewer'] as const).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)}>
                {PROJECT_ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <p className="panel__label">편집자는 원고를 고칠 수 있고, 보기 전용은 읽기만 할 수 있어요.</p>
        </fieldset>
        <Button type="submit" busy={busy}>
          초대 보내기
        </Button>
        <p className="panel__label">초대하면 알림과 이메일로 안내돼요. 가입하지 않은 이메일이면 회원가입 안내가 함께 가요.</p>
      </form>
    </section>
  )
}

function InvitationRow({ invitation: i, onCancel, onResend }: { invitation: ProjectInvitation; onCancel: () => Promise<void>; onResend: () => Promise<void> }) {
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
        <span className="members__email">{PROJECT_ROLE_LABEL[i.role]}</span>
      </span>
      <span className={`badge ${STATUS[i.status].badge}`}>{STATUS[i.status].label}</span>
      {i.status === 'pending' && (
        <Button tone="outline" onClick={act(onCancel)} busy={busy}>
          취소
        </Button>
      )}
      {i.status === 'expired' && (
        <Button tone="soft" onClick={act(onResend)} busy={busy}>
          다시 초대
        </Button>
      )}
    </li>
  )
}
