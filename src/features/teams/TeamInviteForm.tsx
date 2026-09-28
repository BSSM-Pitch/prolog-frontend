import { useState, type FormEvent } from 'react'
import * as api from '../../api/teams'
import type { TeamInvitation } from '../../api/types'
import { useSession } from '../../auth/session'
import { inviteUrl } from '../../api/sentInvitations'
import { Button } from '../../components/Button'
import { InviteLink } from '../../components/InviteLink'
import { TextField } from '../../components/TextField'
import { describeError } from '../../lib/errors'
import { TEAM_ROLE_LABEL } from '../../lib/roles'
import { EMAIL_RULE } from '../../lib/validation'

interface Props {
  teamId: string
  /** inline: Figma 26처럼 이메일·역할·버튼을 한 줄에 */
  layout?: 'inline' | 'stack'
  autoFocus?: boolean
  onInvited?: (inv: TeamInvitation) => void
}

/** TEAM 4.7 팀원 초대 (Figma 25 · 26 · 29 공용) */
export function TeamInviteForm({ teamId, layout = 'stack', autoFocus, onInvited }: Props) {
  const { withAuth } = useSession()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamInvitation['role']>('member')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSent(null)
    setLink(null)
    const value = email.trim()
    if (!EMAIL_RULE.test(value)) return setError('이메일 형식을 확인해 주세요.')
    setBusy(true)
    try {
      const res = await withAuth((t) => api.inviteToTeam(t, teamId, { invited_email: value, role }))
      onInvited?.(res.data)
      setLink(inviteUrl('team', teamId, res.data.invitation_id, res.data.token))
      setSent(res.meta.is_registered === false ? `${value}에 회원가입 안내와 함께 초대를 보냈어요.` : `${value}에 초대를 보냈어요. 7일 안에 수락하면 합류해요.`)
      setEmail('')
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={`team-invite team-invite--${layout}`} onSubmit={submit} noValidate>
      <TextField
        label="이메일"
        type="email"
        value={email}
        onChange={(v) => {
          setEmail(v)
          setError(null)
        }}
        placeholder="writer@example.com"
        error={error}
        success={sent}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      <label className="team-invite__role">
        <span className="field__label">역할</span>
        <select className="nl-select" value={role} onChange={(e) => setRole(e.target.value as TeamInvitation['role'])}>
          {(['member', 'admin'] as const).map((r) => (
            <option key={r} value={r}>
              {TEAM_ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" busy={busy}>
        초대 보내기
      </Button>
      {link && (
        <div className="team-invite__link">
          <InviteLink url={link} />
        </div>
      )}
    </form>
  )
}
