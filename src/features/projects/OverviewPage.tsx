import { useEffect, useState, type ReactNode } from 'react'
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

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>
  const to = (sub = '') => projectPath(project.project_id, sub)
  const ov = load?.key === key ? load.data : null
  const error = load?.key === key ? load.error : null

  return (
    <div className="overview">
      <header>
        <p className="page-crumb">개요 / {project.title}</p>
        <h1 className="page-title">{project.title}</h1>
        <p className="page-desc">{project.description ?? '작품 소개를 아직 적지 않았어요.'}</p>
      </header>

      {error && (
        <div className="panel overview__problem" role="alert">
          <p className="panel__title">개요를 불러오지 못했어요</p>
          <p className="page-desc">{error}</p>
          <Button tone="outline" onClick={() => setReloadKey((k) => k + 1)}>
            다시 시도
          </Button>
        </div>
      )}

      {!error && !ov && <p className="page-desc" role="status">작품 현황을 모으고 있어요</p>}

      {ov && (
        <>
          <section className="overview__section" aria-labelledby="ov-status">
            <h2 id="ov-status" className="section-title">
              작품 현황
            </h2>
            <div className="overview__metrics">
              <Metric
                label="현재 원고"
                value={ov.current_manuscript?.title ?? '원고 없음'}
                detail={ov.current_manuscript ? `${ov.current_manuscript.last_chapter}장까지 작성` : '원고를 올리거나 새로 써 보세요'}
              />
              <Metric
                label="이야기 구조"
                value={ov.story ? `사건 ${ov.story.event_count}개` : '분석 전'}
                detail={ov.story ? `${ov.story.analyzed_through}장 분석 완료` : '스토리 지도에서 분석할 수 있어요'}
              />
            </div>
          </section>

          <section className="overview__section" aria-labelledby="ov-next">
            <h2 id="ov-next" className="section-title">
              다음 작업
            </h2>
            <div className="overview__tasks">
              {ov.current_manuscript ? (
                <Task
                  title="쓰기 이어가기"
                  detail={`${ov.current_manuscript.last_chapter}장 계속 작성`}
                  action={
                    <Link className="btn btn--primary btn--block" to={to(`manuscripts/${ov.current_manuscript.manuscript_id}`)}>
                      원고 열기
                    </Link>
                  }
                />
              ) : (
                <Task
                  title="원고 시작하기"
                  detail="파일을 올리거나 편집기에서 써요"
                  action={
                    <Link className="btn btn--primary btn--block" to={to('manuscripts')}>
                      원고 추가
                    </Link>
                  }
                />
              )}
              <Task
                title="충돌 해결"
                detail={ov.tasks.conflicts_pending > 0 ? `미해결 ${ov.tasks.conflicts_pending}건` : '미해결 충돌이 없어요'}
                action={
                  <Link className="btn btn--secondary btn--block" to={to('conflicts')}>
                    {ov.tasks.conflicts_pending > 0 ? '첫 항목 검토' : '충돌 검토 열기'}
                  </Link>
                }
              />
              <Task
                title="복선 회수"
                detail={ov.tasks.foreshadowing_unscheduled > 0 ? `시점 미정 ${ov.tasks.foreshadowing_unscheduled}건` : '남은 복선이 없어요'}
                action={
                  <Link className="btn btn--secondary btn--block" to={to('foreshadowings')}>
                    {ov.tasks.foreshadowing_unscheduled > 0 ? '회수 장면 지정' : '복선 추적 열기'}
                  </Link>
                }
              />
            </div>
          </section>

          <section className="overview__section" aria-labelledby="ov-review">
            <h2 id="ov-review" className="section-title">
              관계와 검토
            </h2>
            <div className="panel overview__review">
              <div className="panel overview__relations">
                {ov.relationships ? (
                  <>
                    <p className="panel__title">최근 관계 변화 / {ov.relationships.chapter}장</p>
                    <MiniGraph data={ov.relationships} />
                  </>
                ) : (
                  <>
                    <p className="panel__title">최근 관계 변화</p>
                    <p className="page-desc overview__empty">아직 기록된 관계 변화가 없어요. 관계 화면에서 인물 사이의 첫 상태를 기록해 보세요.</p>
                  </>
                )}
                <Link className="btn btn--secondary overview__relations-open" to={to('relationships')}>
                  관계 화면 열기
                </Link>
              </div>

              <div className="panel overview__priority">
                <p className="panel__title">다음 작업 / 우선순위 높음</p>
                {ov.priority ? (
                  <>
                    <p className="overview__priority-title">{ov.priority.title}</p>
                    <div className="overview__badges">
                      <span className="badge badge--waiting">검토 대기</span>
                      <span className="badge badge--done">AI 분석 완료</span>
                    </div>
                    <p className="overview__priority-ref">
                      설정 충돌 {String(ov.priority.index).padStart(2, '0')} · {ov.priority.chapters.map((c) => `${c}장`).join(' ↔ ')}
                    </p>
                    <p className="overview__note">서로 다른 두 장면의 기록을 비교해 보세요.</p>
                    <Link className="btn btn--secondary btn--block" to={`${to('conflicts')}?focus=${ov.priority.conflict_id}`}>
                      검토 시작
                    </Link>
                  </>
                ) : (
                  <p className="page-desc overview__empty">지금 검토할 항목이 없어요. 새 장면을 쓰면 설정과 부딪히는 곳을 찾아 드려요.</p>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="panel overview__metric">
      <p className="panel__label">{label}</p>
      <p className="overview__metric-value">{value}</p>
      <p className="panel__label">{detail}</p>
    </div>
  )
}

function Task({ title, detail, action }: { title: string; detail: string; action: ReactNode }) {
  return (
    <div className="panel overview__task">
      <p className="panel__title">{title}</p>
      <p className="panel__label">{detail}</p>
      {action}
    </div>
  )
}

const POSITIONS = ['right', 'left', 'top', 'bottom'] as const

/** 중심 인물과 최대 4명의 관계를 십자 모양으로 보여 주는 작은 관계도 */
function MiniGraph({ data }: { data: NonNullable<ProjectOverview['relationships']> }) {
  // 신뢰가 가장 높은 관계를 오른쪽(강조)에 둔다
  const edges = [...data.edges].sort((a, b) => b.trust - a.trust).slice(0, 4)
  return (
    <div className="mini-graph" role="img" aria-label={`${data.center.name} 중심 관계도: ${edges.map((e) => `${e.name} ${e.state} ${e.trust}`).join(', ')}`}>
      {edges.map((e, i) => (
        <span key={e.character_id} className={`mini-graph__line mini-graph__line--${POSITIONS[i]}`} aria-hidden="true" />
      ))}
      <div className="mini-graph__node mini-graph__node--center">
        <strong>{data.center.name}</strong>
        <span>{data.center.role_label}</span>
      </div>
      {edges.map((e, i) => (
        <div key={e.character_id} className={`mini-graph__node mini-graph__node--${POSITIONS[i]}${i === 0 ? ' mini-graph__node--strong' : ''}`}>
          <strong>{e.name}</strong>
          <span>
            {e.state} {e.trust}
          </span>
        </div>
      ))}
    </div>
  )
}
