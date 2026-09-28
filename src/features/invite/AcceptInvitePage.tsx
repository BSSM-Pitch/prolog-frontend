import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import * as membersApi from '../../api/members'
import * as teamsApi from '../../api/teams'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { josa } from '../../lib/josa'
import { notifyTeamsChanged } from '../teams/teamEvents'

const MESSAGES: Record<string, string> = {
  INVITATION_EXPIRED: '만료된 초대예요. 초대한 사람에게 새 링크를 요청해 주세요.',
  INVITATION_NOT_FOUND: '초대를 찾을 수 없어요. 취소되었거나 링크가 잘못됐을 수 있어요.',
  TEAM_INVITATION_NOT_FOUND: '초대를 찾을 수 없어요. 취소되었거나 링크가 잘못됐을 수 있어요.',
  INVITATION_NOT_PENDING: '이미 수락한 초대예요.',
  ALREADY_MEMBER: '이미 이 프로젝트에 참여하고 있어요.',
  ALREADY_TEAM_MEMBER: '이미 이 팀의 팀원이에요.',
}

// 초대 링크 /invite/:kind/:parentId/:invitationId?token=… (PRJ 4.8 · TEAM 4.9)
export function AcceptInvitePage() {
  const { kind, parentId = '', invitationId = '' } = useParams()
  const token = useSearchParams()[0].get('token') ?? ''
  const navigate = useNavigate()
  const { withAuth, user } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isTeam = kind === 'team'
  const target = isTeam ? `/teams/${parentId}` : `/projects/${parentId}`

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      if (isTeam) {
        await withAuth((t) => teamsApi.acceptTeamInvitation(t, parentId, invitationId, token))
        notifyTeamsChanged()
      } else {
        await withAuth((t) => membersApi.acceptInvitation(t, parentId, invitationId, token))
      }
      navigate(target, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError && MESSAGES[e.code] ? MESSAGES[e.code] : describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const invalid = (kind !== 'team' && kind !== 'project') || !token

  return (
    <div className="state-block" style={{ maxWidth: 560 }}>
      <p className="page-crumb">초대</p>
      <h1 className="page-title">{isTeam ? '팀 초대' : '프로젝트 초대'}를 받았어요</h1>
      {invalid ? (
        <p className="notice notice--error">초대 링크가 올바르지 않아요. 받은 링크를 그대로 열어 주세요.</p>
      ) : (
        <>
          <p className="page-desc">
            {user?.username} 계정으로 참가해요. 참가하면 {josa(isTeam ? '팀 작업공간' : '프로젝트', '으로/로')} 바로 이동해요.
          </p>
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}
          <div className="actions-row">
            <Button onClick={accept} busy={busy}>
              참가하기
            </Button>
            <Link className="btn btn--outline" to="/projects">
              나중에
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
