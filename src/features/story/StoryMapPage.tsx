import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { IconChevronDown } from '@tabler/icons-react'
import { ApiError } from '../../api/client'
import { IS_REAL } from '../../api/config'
import * as manuscriptsApi from '../../api/manuscripts'
import * as api from '../../api/story'
import type { Manuscript, StructureMap, StructureNode } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { TextArea } from '../../components/TextArea'
import { describeError } from '../../lib/errors'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import { EVENTS_PER_PAGE, eventConnections, eventPage, keyEvents, orderedEvents } from './storyModel'
import { useStoryAnalysis } from './useStoryAnalysis'
import { InsightNav } from '../insights/InsightNav'
import './story.css'

const TYPE_LABEL = { event: '사건', turning_point: '전환점', climax: '절정' } as const
const chapterLabel = (node: StructureNode) => (node.chapter > 0 ? `${node.chapter}장` : '위치 미정')

export function StoryMapPage() {
  const project = useProject()
  if (!project) return <p className="page-desc">작품을 불러오고 있어요</p>
  return (
    <StoryManuscripts key={project.project_id} projectId={project.project_id} canEdit={project.my_role !== 'viewer'} />
  )
}

function StoryManuscripts({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [params, setParams] = useSearchParams()
  const manuscripts = useResource((token) => manuscriptsApi.listManuscripts(token, projectId), [projectId])
  const ready = [...(manuscripts.data ?? [])]
    .filter((m) => m.status === 'ready')
    .sort((a, b) => b.chapter_count - a.chapter_count)
  const current = ready.find((m) => m.manuscript_id === params.get('manuscript')) ?? ready[0]

  return (
    <div className="story">
      <header className="story__header">
        <h1 className="page-title">이야기 흐름</h1>
        {current &&
          (ready.length > 1 ? (
            <label className="story__pick">
              <span className="visually-hidden">분석할 원고</span>
              <select
                value={current.manuscript_id}
                onChange={(e) => setParams({ manuscript: e.target.value }, { replace: true })}
              >
                {ready.map((m) => (
                  <option key={m.manuscript_id} value={m.manuscript_id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="story__manuscript">{current.title}</p>
          ))}
      </header>
      <InsightNav projectId={projectId} />
      {manuscripts.loading && !current && (
        <p className="story__status" role="status">
          원고를 불러오고 있어요.
        </p>
      )}
      {manuscripts.error && (
        <div className="story__status" role="alert">
          <p>{manuscripts.error}</p>
          <Button tone="outline" onClick={manuscripts.reload}>
            다시 불러오기
          </Button>
        </div>
      )}
      {!manuscripts.loading && !manuscripts.error && !current && (
        <div className="story__empty">
          <h2>먼저 원고를 써 보세요.</h2>
          <Link className="btn btn--primary" to={projectPath(projectId, 'manuscripts')}>
            원고 열기
          </Link>
        </div>
      )}
      {current && (
        <StoryFlow key={current.manuscript_id} projectId={projectId} manuscript={current} canEdit={canEdit} />
      )}
    </div>
  )
}

function StoryFlow({
  projectId,
  manuscript,
  canEdit,
}: {
  projectId: string
  manuscript: Manuscript
  canEdit: boolean
}) {
  const { withAuth } = useSession()
  const [params, setParams] = useSearchParams()
  const manuscriptId = manuscript.manuscript_id
  const map = useResource(
    async (token) => {
      try {
        return await api.getStructureMap(token, projectId, manuscriptId)
      } catch (e) {
        if (e instanceof ApiError && e.code === 'STRUCTURE_MAP_NOT_FOUND') return null
        throw e
      }
    },
    [projectId, manuscriptId],
  )
  const chapters = useResource(
    (token) => manuscriptsApi.listChapters(token, projectId, manuscriptId),
    [projectId, manuscriptId],
  )
  const analysis = useStoryAnalysis(projectId, manuscriptId, map.reload)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const timeline = useRef<HTMLOListElement>(null)
  const data = map.data
  const all = orderedEvents(data?.nodes ?? [])
  const main = keyEvents(all)
  const requestedNode =
    all.find((node) => node.node_id === params.get('node')) ??
    (params.has('node') ? null : all.find((node) => node.chapter === Number(params.get('chapter'))))
  const showAll =
    params.get('view') === 'all' || (!!requestedNode && !main.some((node) => node.node_id === requestedNode.node_id))
  const filtered = showAll ? all : main
  const selectedIndex = filtered.findIndex((node) => node.node_id === requestedNode?.node_id)
  const page = eventPage(
    filtered,
    selectedIndex >= 0 ? Math.floor(selectedIndex / EVENTS_PER_PAGE) + 1 : Number(params.get('page') ?? 1),
  )
  const selected = page.nodes.find((node) => node.node_id === requestedNode?.node_id)
  const editorPath = projectPath(projectId, `manuscripts/${manuscriptId}`)
  const returnChapter = Number(params.get('chapter'))
  const returnTo = chapters.data?.some((chapter) => chapter.chapter_no === returnChapter)
    ? `${editorPath}?chapter=${returnChapter}`
    : editorPath

  useEffect(() => {
    if (!focusId || editingId) return
    const button = Array.from(timeline.current?.querySelectorAll<HTMLButtonElement>('[data-event-id]') ?? []).find(
      (el) => el.dataset.eventId === focusId,
    )
    button?.focus({ preventScroll: true })
    button?.scrollIntoView({ block: 'nearest' })
  }, [focusId, editingId, params])

  function updateView(changes: { node?: string; view?: string; page?: string }) {
    const next = new URLSearchParams(params)
    next.set('manuscript', manuscriptId)
    for (const [key, value] of Object.entries(changes)) {
      if (value || key === 'node') next.set(key, value)
      else next.delete(key)
    }
    setEditingId(null)
    setFocusId(null)
    setParams(next, { replace: true })
  }

  function selectNode(node: StructureNode, focus = false) {
    // 빈 node 값은 편집기에서 전달한 장의 초기 선택도 해제한다.
    const next = new URLSearchParams(params)
    next.set('manuscript', manuscriptId)
    next.set('node', !focus && selected?.node_id === node.node_id ? '' : node.node_id)
    if (showAll || !filtered.some((item) => item.node_id === node.node_id)) next.set('view', 'all')
    next.set('page', String(page.page))
    setEditingId(null)
    setFocusId(focus ? node.node_id : null)
    setParams(next, { replace: true })
  }

  return (
    <>
      <div className="story__toolbar">
        {all.length > 0 ? (
          <div className="story__views" role="group" aria-label="보여줄 사건">
            <button type="button" aria-pressed={!showAll} onClick={() => updateView({ view: '', node: '', page: '' })}>
              주요 사건
            </button>
            <button
              type="button"
              aria-pressed={showAll}
              onClick={() => updateView({ view: 'all', node: '', page: '' })}
            >
              모든 사건
            </button>
          </div>
        ) : (
          <span className="story__origin">{IS_REAL ? 'AI 원고 분석' : '시연용 원고 분석'}</span>
        )}
        <Link className="text-link story__return" to={returnTo}>
          원고로 돌아가기
        </Link>
      </div>

      {analysis.running && !analysis.pollError && (
        <p className="story__status" role="status">
          이야기의 흐름을 읽고 있어요. 원고를 쓰며 기다려도 좋아요.
        </p>
      )}
      {analysis.pollError && (
        <div className="story__status" role="alert">
          <p>분석 상태를 확인하지 못했어요. {analysis.pollError}</p>
          <Button tone="outline" onClick={analysis.resume}>
            상태 다시 확인
          </Button>
        </div>
      )}
      {analysis.failed && !analysis.running && (
        <p className="story__status" role="alert">
          분석을 마치지 못했어요. {data ? '이전 결과는 그대로 남아 있어요.' : '다시 시도해 주세요.'}
        </p>
      )}
      {analysis.error && (
        <p className="story__status" role="alert">
          {analysis.error}
        </p>
      )}
      {map.loading && !data && (
        <p className="story__status" role="status">
          흐름을 불러오고 있어요.
        </p>
      )}
      {map.error && (
        <div className="story__status" role="alert">
          <p>{map.error}</p>
          <Button tone="outline" onClick={map.reload}>
            다시 불러오기
          </Button>
        </div>
      )}

      {!map.loading && !map.error && all.length === 0 && !analysis.running && (
        <div className="story__empty">
          <h2>{data ? '아직 찾은 사건이 없어요.' : '아직 분석한 흐름이 없어요.'}</h2>
          <p>{data ? '원고에 이야기를 더한 뒤 다시 분석해 보세요.' : '원고에서 주요 사건과 그 연결을 정리해요.'}</p>
          {canEdit ? (
            <Button onClick={analysis.analyze} disabled={analysis.running}>
              {data ? '다시 분석' : '원고 분석하기'}
            </Button>
          ) : (
            <p>작품을 편집할 수 있는 사람이 분석을 시작할 수 있어요.</p>
          )}
        </div>
      )}

      {data && all.length > 0 && (
        <>
          <ol className="story__timeline" ref={timeline} aria-label={showAll ? '모든 사건의 흐름' : '주요 사건의 흐름'}>
            {page.nodes.map((node) => {
              const open = selected?.node_id === node.node_id
              return (
                <li key={node.node_id} className={`story__event${open ? ' is-open' : ''}`}>
                  <h2>
                    <button
                      type="button"
                      className="story__event-toggle"
                      data-event-id={node.node_id}
                      aria-expanded={open}
                      aria-controls={`event-detail-${node.node_id}`}
                      onClick={() => selectNode(node)}
                    >
                      <span className="story__chapter">{chapterLabel(node)}</span>
                      <span className="story__event-title">{node.title}</span>
                      <IconChevronDown size={18} stroke={1.8} className="story__chevron" aria-hidden="true" />
                    </button>
                  </h2>
                  <div id={`event-detail-${node.node_id}`} hidden={!open}>
                    {open && (
                      <div className="story__detail">
                        {editingId === node.node_id ? (
                          <NodeForm
                            key={node.node_id}
                            node={node}
                            onCancel={() => {
                              setEditingId(null)
                              setFocusId(node.node_id)
                            }}
                            onSubmit={async (input) => {
                              const updated = await withAuth((token) =>
                                api.updateNode(token, projectId, manuscriptId, node.node_id, input),
                              )
                              map.setData((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      nodes: prev.nodes.map((item) =>
                                        item.node_id === updated.node_id ? updated : item,
                                      ),
                                    }
                                  : prev,
                              )
                              setEditingId((current) => (current === node.node_id ? null : current))
                            }}
                          />
                        ) : (
                          <>
                            <p className="story__context">
                              {TYPE_LABEL[node.type]}
                              {node.characters.length > 0 ? ` · ${node.characters.join(', ')}` : ''}
                            </p>
                            {node.summary && <p className="story__summary">{node.summary}</p>}
                            <Connections
                              key={node.node_id}
                              map={data}
                              node={node}
                              onSelect={(target) => selectNode(target, true)}
                            />
                            <div className="story__detail-actions">
                              {chapters.data?.some((chapter) => chapter.chapter_no === node.chapter) && (
                                <Link className="text-link" to={`${editorPath}?chapter=${node.chapter}`}>
                                  {node.chapter}장 원문 읽기
                                </Link>
                              )}
                              {canEdit && (
                                <button
                                  type="button"
                                  className="text-link"
                                  disabled={analysis.running}
                                  onClick={() => {
                                    setFocusId(node.node_id)
                                    setEditingId(node.node_id)
                                  }}
                                >
                                  요약 수정
                                </button>
                              )}
                            </div>
                            {chapters.error && (
                              <p className="story__context">
                                원문 위치를 불러오지 못했어요.{' '}
                                <button type="button" className="text-link" onClick={chapters.reload}>
                                  다시 확인
                                </button>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
          {page.count > 1 && (
            <nav className="story__pagination" aria-label="사건 목록 페이지">
              <Button
                tone="outline"
                disabled={page.page === 1}
                onClick={() => updateView({ page: String(page.page - 1), node: '' })}
              >
                이전 사건
              </Button>
              <span aria-live="polite">
                {page.page} / {page.count}
              </span>
              <Button
                tone="outline"
                disabled={page.page === page.count}
                onClick={() => updateView({ page: String(page.page + 1), node: '' })}
              >
                다음 사건
              </Button>
            </nav>
          )}
          <footer className="story__footer">
            <span>{IS_REAL ? 'AI가 정리한 흐름' : '시연용 분석 결과'}</span>
            {canEdit && (
              <button
                type="button"
                className="text-link"
                disabled={analysis.running || editingId !== null}
                onClick={analysis.analyze}
              >
                다시 분석
              </button>
            )}
          </footer>
        </>
      )}
    </>
  )
}

function Connections({
  map,
  node,
  onSelect,
}: {
  map: StructureMap
  node: StructureNode
  onSelect: (node: StructureNode) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const connections = eventConnections(map, node.node_id)
  if (!connections.length) return null
  return (
    <div className="story__connections">
      <ul aria-label="연결된 사건">
        {(expanded ? connections : connections.slice(0, 2)).map(({ node: target, label, key }) => (
          <li key={key}>
            <button type="button" onClick={() => onSelect(target)}>
              <span className="story__connection-label">{label}</span>
              <span className="story__connection-title">
                {target.title} <span>{chapterLabel(target)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {connections.length > 2 && (
        <button type="button" className="text-link" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? '연결 접기' : `연결 ${connections.length - 2}개 더 보기`}
        </button>
      )}
    </div>
  )
}

function NodeForm({
  node,
  onCancel,
  onSubmit,
}: {
  node: StructureNode
  onCancel: () => void
  onSubmit: (input: { title: string; summary: string }) => Promise<void>
}) {
  const [title, setTitle] = useState(node.title)
  const [summary, setSummary] = useState(node.summary)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!title.trim()) return setError('사건 제목을 입력해 주세요.')
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ title: title.trim(), summary: summary.trim() })
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }
  return (
    <form className="story__form" onSubmit={submit}>
      <label>
        <span>사건 제목</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus disabled={busy} />
      </label>
      <label>
        <span>요약</span>
        <TextArea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} disabled={busy} />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="story__detail-actions">
        <Button type="submit" busy={busy} disabled={busy}>
          저장
        </Button>
        <Button tone="outline" onClick={onCancel} disabled={busy}>
          취소
        </Button>
      </div>
    </form>
  )
}
