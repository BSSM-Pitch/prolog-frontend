import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as projectsApi from '../../api/projects'
import type { ProjectOverview } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { projectPath, useProject } from '../app/currentProject'
import './OverviewPage.css'

type Load = { key: string; data: ProjectOverview | null; error: string | null }

// Figma 841:784 · 01 개요 (붉은 문 너머)
export function OverviewPage() {
  const project = useProject()
  const { withAuth } = useSession()
  const [load, setLoad] = useState<Load | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const projectId = project?.project_id
  const key = `${projectId}|${reloadKey}`

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    withAuth((token) => projectsApi.getOverview(token, projectId))
      .then((data) => !cancelled && setLoad({ key, data, error: null }))
      .catch((e) => !cancelled && setLoad({ key, data: null, error: describeError(e) }))
    return () => {
      cancelled = true
    }
  }, [projectId, key, withAuth])

  if (!project) return <p className="page-desc">작품을 불러오고 있어요</p>
  const to = (sub = '') => projectPath(project.project_id, sub)
  const ov = load?.key === key ? load.data : null
  const error = load?.key === key ? load.error : null

  return (
    <div className="overview">
      <header className="overview__header">
        <p className="page-crumb">{project.owner_type === 'team' ? (project.team_name ?? '팀 작품') : '개인 작품'}</p>
        <h1 className="page-title">{project.title}</h1>
        {project.description && <p className="overview__description">{project.description}</p>}
      </header>
      {error && (
        <div className="panel overview__problem" role="alert">
          <p className="panel__title">작품 현황을 불러오지 못했어요</p>
          <p className="page-desc">{error}</p>
          <Button tone="outline" onClick={() => setReloadKey((k) => k + 1)}>
            다시 시도
          </Button>
        </div>
      )}
      {!error && !ov && (
        <p className="page-desc" role="status">
          작품 현황을 불러오고 있어요
        </p>
      )}
      {ov && (
        <div className="overview__workspace">
          <section className="overview__resume" aria-labelledby="resume-title">
            <p className="section-title">쓰고 있는 원고</p>
            <h2 id="resume-title">{ov.current_manuscript?.title ?? '첫 장을 펼쳐 보세요.'}</h2>
            <p className="overview__chapter">
              {ov.current_manuscript
                ? `${ov.current_manuscript.last_chapter}장까지 작성`
                : '새로 쓰거나, 써 둔 원고를 가져올 수 있어요.'}
            </p>
            <Link
              className="btn btn--primary"
              to={
                ov.current_manuscript
                  ? to(
                      `manuscripts/${ov.current_manuscript.manuscript_id}?chapter=${ov.current_manuscript.last_chapter}`,
                    )
                  : to('manuscripts')
              }
            >
              {ov.current_manuscript ? (project.my_role === 'viewer' ? '원고 읽기' : '이어서 쓰기') : '원고 시작하기'}
            </Link>
            {ov.current_manuscript && (
              <Link className="text-link overview__all" to={to('manuscripts')}>
                원고 전체 보기
              </Link>
            )}
          </section>
          <section className="overview__review" aria-labelledby="review-title">
            <h2 id="review-title" className="section-title">
              설정 검토
            </h2>
            <p className="overview__review-count">
              {ov.tasks.conflicts_pending}
              <span>건 남음</span>
            </p>
            {ov.priority && ov.tasks.conflicts_pending > 0 ? (
              <>
                <p className="overview__priority-title">{ov.priority.title}</p>
                <p className="panel__label">
                  {ov.priority.chapters.map((c) => (c ? `${c}장` : '세계관 설정')).join(' · ')}
                </p>
              </>
            ) : (
              <p className="page-desc">검토할 설정 충돌이 없어요.</p>
            )}
            <Link className="text-link" to={to('conflicts')}>
              {ov.tasks.conflicts_pending > 0 ? '검토하기' : '검토 기록 보기'}
            </Link>
          </section>
        </div>
      )}
    </div>
  )
}
