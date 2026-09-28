import { Link, useParams } from 'react-router-dom'
import * as api from '../../api/teams'
import { useResource } from '../../lib/useResource'
import { relativeTime } from '../../lib/relativeTime'
import { TEAM_ROLE_LABEL } from '../../lib/roles'
import { projectPath } from '../app/currentProject'
import '../world/world.css'
import { TeamInviteForm } from './TeamInviteForm'
import './teams.css'

const pad = (n: number) => String(n).padStart(2, '0')
const WEEK = 7 * 86_400_000
/** (명세 미정의) "작업 중" — 최근 7일 안에 고친 팀 프로젝트 */
const isActive = (updatedAt: string) => Date.now() - new Date(updatedAt).getTime() < WEEK

// Figma 843:2184 · 26 팀 작업공간 (예: 문장 수집소)
export function TeamPage() {
  const { teamId = '' } = useParams()
  const team = useResource((t) => api.getTeam(t, teamId), [teamId])
  const members = useResource((t) => api.listTeamMembers(t, teamId), [teamId])
  const projects = useResource((t) => api.listTeamProjects(t, teamId), [teamId])

  if (team.error && !team.data) {
    return (
      <div className="panel" role="alert">
        <p className="panel__title">팀을 열 수 없어요</p>
        <p className="page-desc">{team.error}</p>
        <Link className="btn btn--outline" to="/projects">
          내 프로젝트로
        </Link>
      </div>
    )
  }
  const t = team.data
  if (!t) return <p className="page-desc">팀을 불러오고 있어요</p>

  const manage = t.my_role !== 'member'
  const list = projects.data ?? []
  const active = list.filter((p) => isActive(p.updated_at)).length

  return (
    <div className="team">
      <header>
        <p className="page-crumb">관리 / 팀 작업공간</p>
        <h1 className="page-title">{t.name}</h1>
        <p className="page-desc">
          협업 창작팀 · 팀원 {t.member_count}명 · 팀 프로젝트 {t.project_count}개{t.description ? ` — ${t.description}` : ''}
        </p>
      </header>

      <div className="team__metrics">
        <Link className="panel team__metric" to={`/teams/${teamId}/members`}>
          <span className="panel__label">팀원</span>
          <strong>{pad(t.member_count)}명</strong>
          <span className="panel__label">{t.pending_invitation_count !== null ? `초대 대기 ${t.pending_invitation_count}` : `내 역할 · ${TEAM_ROLE_LABEL[t.my_role]}`}</span>
        </Link>
        <div className="panel team__metric">
          <span className="panel__label">팀 프로젝트</span>
          <strong>{pad(t.project_count)}개</strong>
          <span className="panel__label">작업 중 {active}</span>
        </div>
      </div>

      <section aria-labelledby="tasks-title" className="team__section">
        <h2 id="tasks-title" className="section-title">
          팀 주요 작업
        </h2>
        <div className="team__tasks">
          <div className="panel">
            <p className="panel__title">팀원 초대</p>
            {manage ? <TeamInviteForm teamId={teamId} layout="inline" onInvited={() => team.reload()} /> : <p className="page-desc">팀원 초대는 소유자와 관리자만 할 수 있어요.</p>}
          </div>
          <div className="panel team__create">
            <p className="panel__title">팀 프로젝트 만들기</p>
            <p className="page-desc">팀의 새로운 작품을 집필하세요</p>
            <Link className="btn btn--primary" to={`/projects/new?team=${teamId}`}>
              새 프로젝트
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="projects-title" className="team__section">
        <h2 id="projects-title" className="section-title">
          팀 프로젝트와 팀원
        </h2>
        <div className="team__grid">
          <div className="panel">
            <p className="panel__title">팀 프로젝트 / {list.length}개</p>
            {list.length === 0 && <p className="page-desc">아직 팀 프로젝트가 없어요. 새 프로젝트를 만들어 팀원과 함께 써 보세요.</p>}
            <ul className="team__projects">
              {list.map((p) => (
                <li key={p.project_id}>
                  <div>
                    <p className="team__project-title">{p.title}</p>
                    <p className="panel__label">
                      원고 {p.manuscript_count}개 · 최근 수정 {relativeTime(p.updated_at)}
                    </p>
                  </div>
                  <Link className="btn btn--outline" to={projectPath(p.project_id)}>
                    프로젝트 열기
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <div className="world__list-head">
              <p className="panel__title">팀원 / {members.data?.length ?? 0}명</p>
              <Link className="text-link" to={`/teams/${teamId}/members`}>
                {manage ? '팀원 관리' : '모두 보기'}
              </Link>
            </div>
            <ul className="team__people">
              {(members.data ?? []).map((m) => (
                <li key={m.user_id}>
                  <span className="team__avatar" aria-hidden="true">
                    {m.name.slice(0, 1)}
                  </span>
                  <span className="team__person">
                    {m.name}
                    <span className="panel__label">{m.email}</span>
                  </span>
                  <span className={m.role === 'owner' ? 'badge badge--done' : 'badge badge--filled'}>{TEAM_ROLE_LABEL[m.role]}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
