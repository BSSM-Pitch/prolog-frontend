import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import * as foreshadowingsApi from '../../api/foreshadowings'
import * as manuscriptsApi from '../../api/manuscripts'
import * as api from '../../api/story'
import type { StructureAnalysis, StructureMap, StructureNode } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import '../characters/characters.css'
import '../manuscripts/answer.css'
import '../relationships/relationships.css'
import '../world/world.css'
import './story.css'
import { TextArea } from '../../components/TextArea'

const TYPE_LABEL = { event: '사건', turning_point: '전환점', climax: '절정' } as const

// Figma 843:1243 · 03 스토리 지도 (+ 상태 명세 1264:2911 스토리 지도 행)
export function StoryMapPage() {
  // 프로젝트를 옮기면 지도·분석 상태를 처음부터 다시 불러온다
  const project = useProject()
  return <StoryMap key={project?.project_id ?? ''} />
}

function StoryMap() {
  const project = useProject()
  const [params, setParams] = useSearchParams()
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const manuscripts = useResource(project ? (t) => manuscriptsApi.listManuscripts(t, projectId) : null, [projectId])
  // 기본은 장이 가장 많은 원고(본편). 메모·외전 같은 짧은 원고는 직접 골라 분석한다
  const ready = [...(manuscripts.data ?? [])].filter((m) => m.status === 'ready').sort((a, b) => b.chapter_count - a.chapter_count)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const latest = ready.find((m) => m.manuscript_id === pickedId) ?? ready[0] ?? null
  const msId = latest?.manuscript_id ?? ''
  const [reloadKey, setReloadKey] = useState(0)
  const map = useResource(msId ? (t) => api.getStructureMap(t, projectId, msId) : null, [projectId, msId, reloadKey])
  const foreshadowings = useResource(project ? (t) => foreshadowingsApi.listForeshadowings(t, projectId) : null, [projectId])

  const [job, setJob] = useState<StructureAnalysis | null>(null)
  const [tooShort, setTooShort] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [editing, setEditing] = useState(false)
  const running = job?.status === 'queued' || job?.status === 'analyzing'
  const jobId = job?.analysis_id

  // 분석이 끝날 때까지 1초마다 확인 (SSM 4.2)
  useEffect(() => {
    if (!running || !jobId || !msId) return
    const id = window.setInterval(() => {
      withAuth((t) => api.getAnalysis(t, projectId, msId, jobId))
        .then((next) => {
          setJob(next)
          if (next.status === 'completed') setReloadKey((k) => k + 1)
        })
        .catch((e) => setError(describeError(e)))
    }, 1000)
    return () => window.clearInterval(id)
  }, [running, jobId, msId, projectId, withAuth])

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>
  const canEdit = project.my_role !== 'viewer'
  // 다른 원고를 고르면 이전 원고의 지도는 보이지 않게 한다
  const data: StructureMap | null = map.data?.manuscript_id === msId ? map.data : null
  const notAnalyzed = map.error !== null && !data
  const nodes = data?.nodes ?? []
  const selected = nodes.find((n) => n.node_id === params.get('node')) ?? nodes.find((n) => n.type === 'turning_point') ?? nodes[0] ?? null

  async function analyze(simulateFailure = false) {
    if (!msId) return
    setError(null)
    setTooShort(null)
    try {
      setJob(await withAuth((t) => api.analyzeStructure(t, projectId, msId, simulateFailure)))
    } catch (e) {
      if (e instanceof ApiError && e.code === 'MANUSCRIPT_TOO_SHORT') setTooShort(e.message)
      else setError(describeError(e))
    }
  }

  const links = (node: StructureNode) => {
    const byId = (id: string) => nodes.find((n) => n.node_id === id)
    const causes = (data?.edges ?? []).filter((e) => e.to_node_id === node.node_id).map((e) => byId(e.from_node_id)).filter(Boolean) as StructureNode[]
    const effects = (data?.edges ?? []).filter((e) => e.from_node_id === node.node_id).map((e) => byId(e.to_node_id)).filter(Boolean) as StructureNode[]
    // 복선의 장 번호는 본편 기준이라 본편 지도에서만 잇는다
    const fs = (latest !== ready[0] ? [] : foreshadowings.data ?? []).filter((f) => f.setup_chapter === node.chapter || f.linked_chapters.includes(node.chapter) || f.payoff_chapter === node.chapter)
    return { causes, effects, fs }
  }

  return (
    <div className="story">
      <header className="world__header">
        <div>
          <p className="page-crumb">AI 원고 분석 / 이야기 구조</p>
          <h1 className="page-title">스토리 지도</h1>
          <p className="page-desc">사건의 원인과 선택, 아직 해결되지 않은 이야기 줄기를 탐색하세요.</p>
        </div>
        {ready.length > 1 && (
          <label className="story__pick">
            <span className="panel__label">분석 원고</span>
            <select className="nl-select" value={latest?.manuscript_id ?? ''} onChange={(e) => (setPickedId(e.target.value), setJob(null), setTooShort(null))}>
              {ready.map((m) => (
                <option key={m.manuscript_id} value={m.manuscript_id}>
                  {m.title} · {m.chapter_count}장
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {manuscripts.data && !latest && (
        <div className="state-block">
          <p className="answer__title">분석할 원고가 없어요</p>
          <p className="answer__body">원고를 올리거나 편집기에서 쓴 뒤 이야기 구조를 분석할 수 있어요.</p>
          <Link className="btn btn--primary" to={projectPath(projectId, 'manuscripts')}>
            원고 추가하기
          </Link>
        </div>
      )}

      {running && (
        <div className="state-block" role="status">
          <span className="answer__spinner" aria-hidden="true" />
          <p className="answer__title">이야기 구조를 분석하고 있어요</p>
          <p className="answer__body">원고 길이에 따라 1–2분 걸릴 수 있어요. 창을 닫아도 분석은 계속돼요.</p>
        </div>
      )}
      {job?.status === 'failed' && (
        <div className="state-block state-block--error" role="alert">
          <p className="answer__title">구조를 분석하지 못했어요</p>
          <p className="answer__body">잠시 뒤 다시 시도해 주세요. 이전 분석 결과가 있다면 그대로 보여 드려요.</p>
          <Button onClick={() => analyze()}>다시 분석</Button>
        </div>
      )}
      {tooShort && (
        <div className="state-block" role="status">
          <p className="answer__title">원고가 조금 더 필요해요</p>
          <p className="answer__body">{tooShort} 몇 장 더 쓴 뒤 분석해 보세요.</p>
          {latest && (
            <Link className="btn btn--primary" to={projectPath(projectId, `manuscripts/${latest.manuscript_id}`)}>
              원고 쓰러 가기
            </Link>
          )}
        </div>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {latest && notAnalyzed && !running && !tooShort && (
        <div className="state-block">
          <p className="answer__title">아직 스토리 지도가 없어요</p>
          <p className="answer__body">“{latest.title}”을 분석해 막 구조와 주요 사건, 인과 관계를 정리해 드려요.</p>
          {canEdit && <Button onClick={() => analyze()}>스토리 지도 만들기</Button>}
        </div>
      )}

      {data && (
        <>
          <section className="panel" aria-labelledby="acts-title">
            <div className="world__list-head">
              <h2 id="acts-title" className="panel__title">
                막 구조
              </h2>
              {canEdit && (
                <Button tone="soft" onClick={() => analyze()} busy={running}>
                  다시 분석
                </Button>
              )}
            </div>
            <ActsBar acts={data.acts} />
          </section>

          <div className="story__layout">
            <section className="panel" aria-labelledby="scenes-title">
              <h2 id="scenes-title" className="panel__title">
                장면 탐색
              </h2>
              <ul className="char-list">
                {nodes.map((n) => (
                  <li key={n.node_id}>
                    <button type="button" className="char-item" aria-current={selected?.node_id === n.node_id || undefined} onClick={() => (setEditing(false), setParams({ node: n.node_id }, { replace: true }))}>
                      <span className="char-item__name">
                        {n.chapter}장 · {n.title}
                      </span>
                      <span className="char-item__meta">{TYPE_LABEL[n.type]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel" aria-labelledby="causal-title">
              <div className="world__list-head">
                <h2 id="causal-title" className="panel__title">
                  인과 지도{selected ? ` / ${selected.chapter}장 선택` : ''}
                </h2>
                <div className="zoom" role="group" aria-label="확대·축소">
                  <button type="button" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))} aria-label="축소">
                    −
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(1)))} aria-label="확대">
                    +
                  </button>
                  <button type="button" onClick={() => setZoom(1)}>
                    전체 보기
                  </button>
                </div>
              </div>
              <CausalMap map={data} zoom={zoom} selectedId={selected?.node_id ?? null} onSelect={(id) => (setEditing(false), setParams({ node: id }, { replace: true }))} />
            </section>

            {selected && (
              <section className="panel story__detail" aria-labelledby="node-title">
                <p className="panel__label">
                  {TYPE_LABEL[selected.type]} · {selected.chapter}장
                </p>
                {editing ? (
                  <NodeForm
                    node={selected}
                    onCancel={() => setEditing(false)}
                    onSubmit={async (input) => {
                      const updated = await withAuth((t) => api.updateNode(t, projectId, msId, selected.node_id, input))
                      map.setData((prev) => (prev ? { ...prev, nodes: prev.nodes.map((n) => (n.node_id === updated.node_id ? updated : n)) } : prev))
                      setEditing(false)
                    }}
                  />
                ) : (
                  <>
                    <h2 id="node-title" className="page-title">
                      {selected.title}
                    </h2>
                    <div>
                      <p className="panel__label">선택한 사건</p>
                      <p className="page-desc">{selected.summary}</p>
                    </div>
                    {selected.characters.length > 0 && (
                      <div>
                        <p className="panel__label">관련 인물</p>
                        <p className="page-desc">{selected.characters.join(', ')}</p>
                      </div>
                    )}
                    <div>
                      <p className="panel__label">연결</p>
                      <ul className="changes">
                        {links(selected).causes.map((n) => (
                          <li key={`c-${n.node_id}`}>
                            <strong>원인</strong> {n.chapter}장 {n.title}
                          </li>
                        ))}
                        {links(selected).effects.map((n) => (
                          <li key={`e-${n.node_id}`}>
                            <strong>영향</strong> {n.chapter}장 {n.title}
                          </li>
                        ))}
                        {links(selected).fs.map((f) => (
                          <li key={f.foreshadowing_id}>
                            <strong>복선</strong>{' '}
                            <Link className="text-link" to={`${projectPath(projectId, 'foreshadowings')}?selected=${f.foreshadowing_id}`}>
                              {f.code} {f.title}
                            </Link>
                          </li>
                        ))}
                        {Object.values(links(selected)).every((l) => l.length === 0) && <li>연결된 사건이 없어요.</li>}
                      </ul>
                    </div>
                    <div className="actions-row">
                      {latest && (
                        <Link className="btn btn--outline" to={`${projectPath(projectId, `manuscripts/${latest.manuscript_id}`)}?chapter=${selected.chapter}`}>
                          원문 보기
                        </Link>
                      )}
                      {canEdit && (
                        <Button tone="outline" onClick={() => setEditing(true)}>
                          사건 수정
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ActsBar({ acts }: { acts: StructureMap['acts'] }) {
  const total = Math.max(1, ...acts.map((a) => a.chapter_to)) - Math.min(...acts.map((a) => a.chapter_from)) + 1
  return (
    <ol className="acts">
      {acts.map((a, i) => (
        <li key={a.act_name} className={`acts__item acts__item--${i === acts.length - 1 ? 3 : i}`} style={{ flexGrow: a.chapter_to - a.chapter_from + 1, flexBasis: `${((a.chapter_to - a.chapter_from + 1) / total) * 100}%` }} title={a.summary}>
          <strong>{a.act_name}</strong>
          <span>
            {a.chapter_from}–{a.chapter_to}장
          </span>
        </li>
      ))}
    </ol>
  )
}

/** 장을 가로축으로 둔 인과 지도. 카드는 두 줄에 번갈아 놓아 겹치지 않게 한다 */
function CausalMap({ map, zoom, selectedId, onSelect }: { map: StructureMap; zoom: number; selectedId: string | null; onSelect: (id: string) => void }) {
  // 100%일 때 패널 너비에 꼭 맞춘다. 확대하면 가로로 스크롤한다
  const box = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(720)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setFit(Math.max(320, Math.floor(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const sorted = [...map.nodes].sort((a, b) => a.chapter - b.chapter)
  // 장 간격이 들쭉날쭉해도 카드가 겹치지 않도록 사건 순서대로 고르게 놓는다
  const W = Math.round(Math.max(fit, sorted.length * 58 + 130) * zoom)
  const H = 300
  const pad = 60
  const x = (i: number) => pad + (sorted.length > 1 ? (i / (sorted.length - 1)) * (W - pad * 2) : (W - pad * 2) / 2)
  const pos = new Map(sorted.map((n, i) => [n.node_id, { x: x(i), y: i % 2 === 0 ? 90 : 190 }]))

  return (
    <div className="causal" ref={box}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="사건 인과 지도">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="causal__arrowhead" />
          </marker>
        </defs>
        <line className="causal__axis" x1={pad} x2={W - pad} y1={H - 30} y2={H - 30} />
        {sorted.map((n, i) => (
          <text key={`t-${n.node_id}`} className="causal__tick" x={x(i)} y={H - 10} textAnchor="middle">
            {n.chapter}장
          </text>
        ))}
        {map.edges.map((e) => {
          const a = pos.get(e.from_node_id)
          const b = pos.get(e.to_node_id)
          if (!a || !b) return null
          return <path key={`${e.from_node_id}-${e.to_node_id}`} className={`causal__edge causal__edge--${e.relation}`} d={`M${a.x + 50},${a.y} C${(a.x + b.x) / 2},${a.y} ${(a.x + b.x) / 2},${b.y} ${b.x - 52},${b.y}`} markerEnd="url(#arrow)" />
        })}
        {sorted.map((n) => {
          const p = pos.get(n.node_id)!
          const selected = n.node_id === selectedId
          return (
            <g
              key={n.node_id}
              className={`causal__node causal__node--${n.type}${selected ? ' is-selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${n.chapter}장 ${n.title} (${TYPE_LABEL[n.type]})`}
              onClick={() => onSelect(n.node_id)}
              onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onSelect(n.node_id))}
            >
              <rect x={p.x - 50} y={p.y - 24} width={100} height={48} rx={8} />
              <text x={p.x} y={p.y - 4} textAnchor="middle" className="causal__label">
                {n.title.length > 8 ? `${n.title.slice(0, 7)}…` : n.title}
              </text>
              <text x={p.x} y={p.y + 14} textAnchor="middle" className="causal__type">
                {TYPE_LABEL[n.type]}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function NodeForm({ node, onCancel, onSubmit }: { node: StructureNode; onCancel: () => void; onSubmit: (i: { title: string; summary: string }) => Promise<void> }) {
  const [title, setTitle] = useState(node.title)
  const [summary, setSummary] = useState(node.summary)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('사건 제목을 입력해 주세요.')
    setBusy(true)
    try {
      await onSubmit({ title: title.trim(), summary: summary.trim() })
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }
  return (
    <form className="record-form" onSubmit={submit} noValidate>
      <label className="field">
        <span className="field__label">사건 제목</span>
        <input className="char-search" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="field">
        <span className="field__label">요약</span>
        <TextArea className="nl-textarea" style={{ minHeight: 80 }} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </label>
      <p className="panel__label">AI 분석 결과를 직접 고치면 다시 분석해도 유지돼요.</p>
      {error && <p className="notice notice--error">{error}</p>}
      <div className="actions-row">
        <Button tone="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" busy={busy}>
          저장
        </Button>
      </div>
    </form>
  )
}
