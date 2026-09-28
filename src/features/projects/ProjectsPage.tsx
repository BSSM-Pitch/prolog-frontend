import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconChevronDown, IconPlus } from '@tabler/icons-react'
import * as projectsApi from '../../api/projects'
import type { OwnerType, Project, ProjectListMeta, ProjectSort } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { relativeTime } from '../../lib/relativeTime'
import './ProjectsPage.css'
import { PROJECT_ROLE_LABEL } from '../../lib/roles'

type Filter = 'all' | OwnerType

const PAGE_SIZE = 6

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'personal', label: '개인' },
  { value: 'team', label: '팀' },
]

const SORTS: Array<{ value: ProjectSort; label: string }> = [
  { value: 'updated_desc', label: '최근 수정순' },
  { value: 'created_desc', label: '최근 만든 순' },
  { value: 'title_asc', label: '이름순' },
]


/** 첫 페이지 요청 결과. key가 현재 필터·정렬과 다르면 아직 불러오는 중이다. */
type FirstPage = { key: string; error: string | null }

// Figma 1260:2218 · 27 내 프로젝트
export function ProjectsPage() {
  const navigate = useNavigate()
  const { withAuth } = useSession()

  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<ProjectSort>('updated_desc')
  const [reloadKey, setReloadKey] = useState(0)
  const [items, setItems] = useState<Project[]>([])
  const [meta, setMeta] = useState<ProjectListMeta | null>(null)
  const [firstPage, setFirstPage] = useState<FirstPage | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  const requestKey = `${filter}|${sort}|${reloadKey}`
  const load =
    firstPage?.key !== requestKey
      ? ({ state: 'loading' } as const)
      : firstPage.error
        ? ({ state: 'error', message: firstPage.error } as const)
        : ({ state: 'ready' } as const)

  const fetchPage = useCallback(
    (cursor: string | null) =>
      withAuth((token) =>
        projectsApi.listProjects(token, {
          owner_type: filter === 'all' ? undefined : filter,
          sort,
          limit: PAGE_SIZE,
          cursor,
        }),
      ),
    [withAuth, filter, sort],
  )

  // 필터·정렬이 바뀌면 첫 페이지부터 다시 불러온다
  useEffect(() => {
    let cancelled = false
    fetchPage(null)
      .then(({ data, meta }) => {
        if (cancelled) return
        setItems(data)
        setMeta(meta)
        setMoreError(null)
        setFirstPage({ key: requestKey, error: null })
      })
      .catch((e) => {
        if (!cancelled) setFirstPage({ key: requestKey, error: describeError(e) })
      })
    return () => {
      cancelled = true
    }
  }, [fetchPage, requestKey])

  async function loadMore() {
    if (!meta?.next_cursor) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const next = await fetchPage(meta.next_cursor)
      setItems((prev) => [...prev, ...next.data])
      setMeta(next.meta)
    } catch (e) {
      setMoreError(describeError(e))
    } finally {
      setLoadingMore(false)
    }
  }

  const counts = meta?.counts

  return (
    <div className="projects">
      <header className="projects__header">
        <div>
          <p className="projects__crumb">
            작품 / {FILTERS.find((f) => f.value === filter)?.label}
          </p>
          <h1 className="projects__title">내 프로젝트</h1>
          <p className="projects__desc">개인 프로젝트와 참여 중인 팀 프로젝트를 한곳에서 관리하세요.</p>
        </div>
        <Button className="projects__new" onClick={() => navigate('/projects/new')}>
          <IconPlus size={16} aria-hidden="true" />새 프로젝트
        </Button>
      </header>

      <div className="projects__toolbar">
        <div className="projects__filters" role="group" aria-label="프로젝트 종류">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className="projects__filter"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              {counts && ` ${counts[f.value]}`}
            </button>
          ))}
        </div>
        <label className="projects__sort">
          <span className="visually-hidden">정렬</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as ProjectSort)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <IconChevronDown size={16} aria-hidden="true" />
        </label>
      </div>

      {load.state === 'loading' && (
        <div className="projects__state" role="status">
          <p className="projects__state-title">프로젝트를 불러오고 있어요</p>
        </div>
      )}

      {load.state === 'error' && (
        <div className="projects__state" role="alert">
          <p className="projects__state-title">프로젝트 목록을 불러오지 못했어요</p>
          <p className="projects__state-body">{load.message}</p>
          <Button tone="outline" onClick={() => setReloadKey((k) => k + 1)}>
            다시 시도
          </Button>
        </div>
      )}

      {load.state === 'ready' && items.length === 0 && (
        <div className="projects__state">
          <p className="projects__state-title">
            {filter === 'team' ? '참여 중인 팀 프로젝트가 없어요' : filter === 'personal' ? '개인 프로젝트가 없어요' : '아직 프로젝트가 없어요'}
          </p>
          <p className="projects__state-body">
            {filter === 'team' ? '팀에 초대받거나 팀을 만들면 이곳에 표시돼요.' : '새 프로젝트를 만들어 첫 원고를 올려 보세요.'}
          </p>
          {filter !== 'team' && <Button onClick={() => navigate('/projects/new')}>새 프로젝트 만들기</Button>}
        </div>
      )}

      {load.state === 'ready' && items.length > 0 && (
        <>
          <ul className="projects__grid">
            {items.map((p) => (
              <li key={p.project_id}>
                <ProjectCard project={p} />
              </li>
            ))}
          </ul>
          {moreError && (
            <p className="notice notice--error projects__more-error" role="alert">
              {moreError}
            </p>
          )}
          {meta?.next_cursor && (
            <button type="button" className="projects__more" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? '불러오는 중…' : '더 보기'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function ProjectCard({ project: p }: { project: Project }) {
  const titleId = `project-${p.project_id}-title`
  return (
    <article className="project-card" aria-labelledby={titleId}>
      <div className="project-card__badges">
        <span className="badge badge--filled">{p.owner_type === 'team' ? `팀 · ${p.team_name ?? '이름 없는 팀'}` : '개인'}</span>
        <span className="badge badge--outline">{PROJECT_ROLE_LABEL[p.my_role]}</span>
      </div>
      <h2 id={titleId} className="project-card__title">
        {p.title}
      </h2>
      <p className="project-card__meta">
        원고 {p.manuscript_count}개 · {relativeTime(p.updated_at)} 수정
      </p>
      <Link className="btn btn--secondary btn--block project-card__open" to={`/projects/${p.project_id}`} aria-describedby={titleId}>
        열기
      </Link>
    </article>
  )
}
