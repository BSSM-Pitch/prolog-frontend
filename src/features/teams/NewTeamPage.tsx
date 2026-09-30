import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../../api/teams'
import type { Team, TeamInvitation } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { describeError } from '../../lib/errors'
import { TEAM_ROLE_LABEL } from '../../lib/roles'
import { TeamInviteForm } from './TeamInviteForm'
import { notifyTeamsChanged } from './teamEvents'
import './teams.css'
import { TextArea } from '../../components/TextArea'

// Figma 843:2082 · 25 새 팀 만들기 — 팀을 만들면 02 초대, 03 팀 프로젝트 단계가 열린다
export function NewTeamPage() {
  const { withAuth } = useSession()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [team, setTeam] = useState<Team | null>(null)
  const [invited, setInvited] = useState<TeamInvitation[]>([])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setNameError('팀 이름을 입력해 주세요.')
    if (name.trim().length > 40) return setNameError('팀 이름은 40자 이하로 정해 주세요.')
    setBusy(true)
    try {
      const created = await withAuth((t) => api.createTeam(t, { name: name.trim(), description: description.trim() || undefined }))
      setTeam(created)
      notifyTeamsChanged()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="team-new">
      <header>
        <p className="page-crumb">관리 / 팀</p>
        <h1 className="page-title">새 팀 만들기</h1>
        <p className="page-desc">협업 창작을 위한 팀을 만들고 팀원을 초대하세요.</p>
      </header>

      <section className={team ? 'panel team-step is-done' : 'panel team-step'} aria-labelledby="step1">
        <p className="team-step__no">01</p>
        <h2 id="step1" className="panel__title">
          팀 만들기
        </h2>
        {team ? (
          <p className="page-desc">
            <strong>{team.name}</strong> 팀을 만들었어요.{team.description ? ` ${team.description}` : ''}
          </p>
        ) : (
          <form className="team-step__form" onSubmit={submit} noValidate>
            <TextField
              label="팀 이름 · 필수"
              value={name}
              onChange={(v) => {
                setName(v)
                setNameError(null)
              }}
              placeholder="문장 수집소"
              error={nameError}
              maxLength={40}
              autoFocus
            />
            <label className="field">
              <span className="field__label">팀 설명 · 선택</span>
              <TextArea className="nl-textarea team-step__desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="미스터리 장편을 함께 기획하고 집필하는 창작팀" maxLength={200} />
            </label>
            {error && (
              <p className="notice notice--error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" busy={busy}>
              팀 만들고 계속
            </Button>
          </form>
        )}
      </section>

      <section className={team ? 'panel team-step' : 'panel team-step is-locked'} aria-labelledby="step2" aria-disabled={!team}>
        <p className="team-step__no">02</p>
        <h2 id="step2" className="panel__title">
          팀원 초대
        </h2>
        <p className="page-desc">이메일로 함께 작업할 팀원을 초대하세요.</p>
        {team ? (
          <>
            <TeamInviteForm teamId={team.team_id} layout="inline" onInvited={(inv) => setInvited((prev) => [inv, ...prev.filter((x) => x.invitation_id !== inv.invitation_id)])} />
            {invited.length > 0 && (
              <ul className="team-step__sent">
                {invited.map((i) => (
                  <li key={i.invitation_id}>
                    {i.invited_email} <span className="badge badge--waiting">{TEAM_ROLE_LABEL[i.role]} · 대기 중</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="team-step__locked">팀을 만든 뒤 초대할 수 있어요</p>
        )}
      </section>

      <section className={team ? 'panel team-step' : 'panel team-step is-locked'} aria-labelledby="step3" aria-disabled={!team}>
        <p className="team-step__no">03</p>
        <h2 id="step3" className="panel__title">
          팀 프로젝트
        </h2>
        <p className="page-desc">팀 소유의 프로젝트를 여러 개 만들어 관리할 수 있습니다.</p>
        {team ? (
          <div className="actions-row">
            <Link className="btn btn--primary" to={`/projects/new?team=${team.team_id}`}>
              팀 프로젝트 만들기
            </Link>
            <Link className="btn btn--outline" to={`/teams/${team.team_id}`}>
              팀 작업공간으로
            </Link>
          </div>
        ) : (
          <p className="team-step__locked">팀을 만든 뒤 만들 수 있어요</p>
        )}
      </section>
    </div>
  )
}
