import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as charactersApi from '../../api/characters'
import { ApiError } from '../../api/client'
import * as manuscriptsApi from '../../api/manuscripts'
import * as api from '../../api/relationships'
import { RELATION_STATES } from '../../api/relationships'
import type { MindmapGraph, Relationship } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { describeError } from '../../lib/errors'
import { useResource } from '../../lib/useResource'
import { useProject } from '../app/currentProject'
import '../characters/characters.css'
import './relationships.css'

type Existing = { chapter: number; state: string; trust: number | null; event_title: string | null }
type Pending = { relationshipId: string; entry: api.EntryInput; existing: Existing }

const stateClass = (state: string) =>
  ({ 신뢰: 'trust', 우호: 'friendly', 중립: 'neutral', 긴장: 'tension', 갈등: 'conflict', 적대: 'hostile' })[state] ?? 'neutral'

/** 장 시점의 상태 — 기록이 없으면 직전 기록을 이어받는다 (RCV 11항) */
function snapshotAt(r: Relationship, chapter: number) {
  const before = r.history.filter((h) => h.chapter <= chapter)
  const h = before[before.length - 1]
  if (!h) return null
  return { ...h, carried: h.chapter !== chapter, previous: before[before.length - 2] ?? null }
}

// Figma 843:1109 · 13 관계 변화 / 1266:3609 · 38 덮어쓰기 확인
export function RelationshipsPage() {
  const project = useProject()
  const [params, setParams] = useSearchParams()
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const rels = useResource(project ? (t) => api.listRelationships(t, projectId) : null, [projectId])
  const characters = useResource(project ? (t) => charactersApi.listCharacters(t, projectId) : null, [projectId])
  const manuscripts = useResource(project ? (t) => manuscriptsApi.listManuscripts(t, projectId) : null, [projectId])

  const list = rels.data ?? []
  const people = characters.data ?? []
  const latestChapter = (manuscripts.data ?? []).filter((m) => m.status === 'ready')[0]?.chapter_count ?? 0
  const maxChapter = Math.max(1, latestChapter, ...list.flatMap((r) => r.history.map((h) => h.chapter)))
  const chapter = Math.min(maxChapter, Number(params.get('chapter')) || maxChapter)
  const focus = params.get('character') ?? ''

  const mindmap = useResource(project ? (t) => api.getMindmap(t, projectId, chapter, focus || undefined) : null, [projectId, chapter, focus, list])
  const selected = list.find((r) => r.relationship_id === params.get('rel')) ?? list.find((r) => !focus || r.source_character_id === focus || r.target_character_id === focus) ?? null

  const [recording, setRecording] = useState(false)
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>
  const canEdit = project.my_role !== 'viewer'
  const nameOf = (id: string) => people.find((c) => c.character_id === id)?.name ?? '?'
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  async function saveRecord(relationshipId: string, entry: api.EntryInput, overwrite = false) {
    setBusy(true)
    setError(null)
    try {
      await withAuth((t) => api.recordState(t, projectId, relationshipId, entry, overwrite))
      setPending(null)
      setRecording(false)
      setNotice(`${entry.chapter}장에 관계 상태를 ${overwrite ? '덮어썼어요' : '기록했어요'}.`)
      rels.reload()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DUPLICATE_CHAPTER_RECORD') {
        setPending({ relationshipId, entry, existing: e.details.existing_entry as Existing })
      } else setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  async function removeRelationship() {
    if (!selected) return
    setBusy(true)
    try {
      await withAuth((t) => api.deleteRelationship(t, projectId, selected.relationship_id))
      setConfirmDelete(false)
      set({ rel: null })
      rels.reload()
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const snap = selected ? snapshotAt(selected, chapter) : null

  return (
    <div className="relations">
      <header>
        <p className="page-crumb">작품 흐름 / {chapter}장 기준</p>
        <h1 className="page-title">관계 변화</h1>
        <p className="page-desc">장면에 따른 관계 변화와 연결 사건을 함께 살펴보세요.</p>
      </header>
      {notice && (
        <p className="notice notice--success" role="status">
          {notice}
        </p>
      )}

      <div className="relations__layout">
        <div className="relations__main">
          <section className="panel" aria-labelledby="mindmap-title">
            <div className="relations__toolbar">
              <h2 id="mindmap-title" className="panel__title">
                관계 마인드맵
              </h2>
              <select className="nl-select" value={focus} onChange={(e) => set({ character: e.target.value, rel: null })} aria-label="인물 필터">
                <option value="">인물 필터 · 전체</option>
                {people.map((c) => (
                  <option key={c.character_id} value={c.character_id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {canEdit && (
                <Button tone="soft" onClick={() => setAdding(true)} disabled={people.length < 2}>
                  + 관계 추가
                </Button>
              )}
            </div>
            <label className="chapter-slider">
              <span className="field__label">
                장 시점 · <strong>{chapter}장</strong> / {maxChapter}장
              </span>
              <input type="range" min={1} max={maxChapter} value={chapter} onChange={(e) => set({ chapter: e.target.value })} />
            </label>
            {mindmap.data && mindmap.data.edges.length === 0 ? (
              <div className="state-block">
                <p className="answer__title">아직 기록된 관계 변화가 없어요</p>
                <p className="answer__body">{list.length === 0 ? '두 인물 사이의 관계를 추가하고 첫 상태를 기록해 보세요.' : `${chapter}장까지는 기록된 관계가 없어요. 장 시점을 뒤로 옮겨 보세요.`}</p>
              </div>
            ) : (
              mindmap.data && (
                <Mindmap
                  graph={mindmap.data}
                  selectedId={selected?.relationship_id ?? null}
                  onSelectEdge={(id) => set({ rel: id })}
                  onSelectNode={(id) => set({ character: id === focus ? null : id, rel: null })}
                />
              )
            )}
            <div className="legend" aria-label="관계 상태 색">
              {RELATION_STATES.map((s) => (
                <span key={s} className={`legend__item state--${stateClass(s)}`}>
                  {s}
                </span>
              ))}
            </div>
          </section>

          {selected && (
            <section className="panel" aria-labelledby="timeline-title">
              <h2 id="timeline-title" className="panel__title">
                관계 타임라인 / 선택한 관계와 동기화
              </h2>
              <Timeline rel={selected} max={maxChapter} current={chapter} onPick={(c) => set({ chapter: String(c) })} />
            </section>
          )}
        </div>

        {selected && (
          <section className="panel relations__detail" aria-labelledby="rel-title">
            <h2 id="rel-title" className="page-title">
              {nameOf(selected.source_character_id)} ↔ {nameOf(selected.target_character_id)}
            </h2>
            {snap ? (
              <>
                <p className="panel__label">
                  {chapter}장 기준 · {snap.carried ? `이어받음 (${snap.chapter}장 기록)` : '직접 기록'}
                </p>
                <div className={`rel-state state--${stateClass(snap.state)}`}>
                  <span className="rel-state__label">현재 상태</span>
                  <strong>
                    {snap.state} {snap.trust ?? ''}
                  </strong>
                </div>
                {snap.carried && <p className="check-note">{chapter}장은 직접 기록이 없어 {snap.chapter}장 상태를 이어서 보여줘요.</p>}
                {snap.previous && (
                  <p className="panel__label">
                    이전 {snap.previous.state} {snap.previous.trust ?? ''} · 변화량 {snap.trust !== null && snap.previous.trust !== null ? `${snap.trust - snap.previous.trust > 0 ? '+' : ''}${snap.trust - snap.previous.trust}` : '—'}
                  </p>
                )}
                {snap.event_title && (
                  <div className="evidence-box">
                    변화 사건 · {snap.chapter}장 {snap.event_title}
                    {snap.event_deleted && <span className="badge badge--error rel-deleted">사건 삭제됨</span>}
                  </div>
                )}
                {snap.event_deleted && <p className="check-note">{snap.chapter}장 사건이 삭제돼 이 기록과의 연결만 풀렸어요. 관계 상태는 그대로예요.</p>}
              </>
            ) : (
              <p className="check-note">이 관계는 {chapter}장까지 상태 미정이에요. 장을 골라 첫 상태를 기록해 보세요.</p>
            )}
            <p className="panel__label">연결된 데이터 · 기록 {selected.history.length}건 · 연결 사건 {selected.history.filter((h) => h.event_title).length}건</p>

            {recording && (
              <RecordForm
                chapter={chapter}
                initial={snap && !snap.carried ? snap : null}
                busy={busy}
                onCancel={() => setRecording(false)}
                onSubmit={(entry) => saveRecord(selected.relationship_id, entry)}
              />
            )}
            {error && (
              <p className="notice notice--error" role="alert">
                {error}
              </p>
            )}
            {canEdit && !recording && (
              <div className="actions-row">
                <Button onClick={() => (setRecording(true), setError(null))}>이 장에 상태 기록</Button>
                <Button tone="error" onClick={() => setConfirmDelete(true)}>
                  관계 삭제
                </Button>
              </div>
            )}
          </section>
        )}
      </div>

      {pending && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPending(null)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="ow-title" onKeyDown={(e) => e.key === 'Escape' && setPending(null)}>
            <h2 id="ow-title" className="panel__title">
              {pending.entry.chapter}장에 이미 기록이 있어요
            </h2>
            <p className="page-desc">같은 장에는 관계 상태를 하나만 기록할 수 있어요. 기존 기록을 새 값으로 바꿀까요?</p>
            <div className="compare">
              <div className={`compare__card state--${stateClass(pending.existing.state)}`}>
                <span className="panel__label">기존 기록</span>
                <strong>
                  {pending.existing.state} {pending.existing.trust ?? ''}
                </strong>
                {pending.existing.event_title && <span className="panel__label">원인 사건: {pending.existing.event_title}</span>}
              </div>
              <div className={`compare__card state--${stateClass(pending.entry.state)}`}>
                <span className="panel__label">새 기록</span>
                <strong>
                  {pending.entry.state} {pending.entry.trust ?? ''}
                </strong>
                {pending.entry.event_title && <span className="panel__label">원인 사건: {pending.entry.event_title}</span>}
              </div>
            </div>
            <div className="dialog__actions">
              <Button tone="outline" onClick={() => setPending(null)} autoFocus>
                취소
              </Button>
              <Button tone="error" busy={busy} onClick={() => saveRecord(pending.relationshipId, pending.entry, true)}>
                덮어쓰기
              </Button>
            </div>
          </div>
        </div>
      )}

      {adding && (
        <AddRelationship
          people={people}
          chapter={chapter}
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            const r = await withAuth((t) => api.createRelationship(t, projectId, input))
            setAdding(false)
            rels.reload()
            set({ rel: r.relationship_id })
          }}
        />
      )}

      {confirmDelete && selected && (
        <ConfirmDialog
          title="관계를 삭제할까요?"
          body={`${nameOf(selected.source_character_id)} ↔ ${nameOf(selected.target_character_id)}의 기록 ${selected.history.length}건이 모두 사라지고 되돌릴 수 없어요.`}
          confirmLabel="삭제"
          busy={busy}
          onConfirm={removeRelationship}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

/** 가장 많이 연결된 인물을 가운데, 나머지를 원형으로 배치한 관계도 */
function Mindmap({ graph, selectedId, onSelectEdge, onSelectNode }: { graph: MindmapGraph; selectedId: string | null; onSelectEdge: (id: string) => void; onSelectNode: (id: string) => void }) {
  const W = 760
  const H = 380
  const degree = (id: string) => graph.edges.filter((e) => e.source_character_id === id || e.target_character_id === id).length
  const nodes = [...graph.nodes].sort((a, b) => degree(b.character_id) - degree(a.character_id))
  const [center, ...rest] = nodes
  const pos = new Map<string, { x: number; y: number }>()
  if (center) pos.set(center.character_id, { x: W / 2, y: H / 2 })
  rest.forEach((n, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(rest.length, 1)
    pos.set(n.character_id, { x: W / 2 + Math.cos(angle) * 290, y: H / 2 + Math.sin(angle) * 140 })
  })

  return (
    <svg className="mindmap" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${graph.chapter}장 관계도`}>
      {graph.edges.map((e) => {
        const a = pos.get(e.source_character_id)
        const b = pos.get(e.target_character_id)
        if (!a || !b) return null
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const selected = e.relationship_id === selectedId
        return (
          <g
            key={e.relationship_id}
            className={`mindmap__edge state--${stateClass(e.state)}${selected ? ' is-selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`관계 ${e.state} ${e.trust ?? ''}${e.is_carried_forward ? ` (${e.resolved_chapter}장 기록 이어받음)` : ''}`}
            onClick={() => onSelectEdge(e.relationship_id)}
            onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onSelectEdge(e.relationship_id))}
          >
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <line className="mindmap__hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <rect x={mx - 38} y={my - 13} width={76} height={26} rx={13} />
            <text x={mx} y={my + 4} textAnchor="middle">
              {e.state} {e.trust ?? ''}
            </text>
          </g>
        )
      })}
      {nodes.map((n, i) => {
        const p = pos.get(n.character_id)!
        const isCenter = i === 0
        return (
          <g
            key={n.character_id}
            className={isCenter ? 'mindmap__node is-center' : 'mindmap__node'}
            role="button"
            tabIndex={0}
            aria-label={`${n.name} 중심으로 보기`}
            onClick={() => onSelectNode(n.character_id)}
            onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onSelectNode(n.character_id))}
          >
            <rect x={p.x - 62} y={p.y - 26} width={124} height={52} rx={10} />
            <text x={p.x} y={p.y - 2} textAnchor="middle" className="mindmap__name">
              {n.name}
            </text>
            <text x={p.x} y={p.y + 16} textAnchor="middle" className="mindmap__role">
              {n.role_label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Timeline({ rel, max, current, onPick }: { rel: Relationship; max: number; current: number; onPick: (chapter: number) => void }) {
  const pct = (c: number) => (max <= 1 ? 50 : ((c - 1) / (max - 1)) * 100)
  return (
    <div className="timeline">
      <div className="timeline__track" aria-hidden="true">
        <span className="timeline__now" style={{ left: `${pct(current)}%` }} />
      </div>
      <ol className="timeline__points">
        {rel.history.map((h, i) => {
          const prev = rel.history[i - 1]
          const changed = prev && prev.state !== h.state
          return (
            <li key={h.chapter} style={{ left: `${pct(h.chapter)}%` }}>
              <button type="button" className={`timeline__point state--${stateClass(h.state)}${h.chapter === current ? ' is-current' : ''}`} onClick={() => onPick(h.chapter)}>
                <span className="timeline__chapter">{h.chapter}장</span>
                <span className="timeline__value">
                  {h.state} {h.trust ?? ''}
                </span>
                {changed && <span className="timeline__change">변화</span>}
              </button>
            </li>
          )
        })}
      </ol>
      <div className="timeline__axis" aria-hidden="true">
        <span>1장</span>
        <span>{max}장</span>
      </div>
    </div>
  )
}

function RecordForm({ chapter, initial, busy, onCancel, onSubmit }: { chapter: number; initial: { state: string; trust: number | null; event_title: string | null } | null; busy: boolean; onCancel: () => void; onSubmit: (e: api.EntryInput) => void }) {
  const [state, setState] = useState(initial?.state ?? '신뢰')
  const [trust, setTrust] = useState(String(initial?.trust ?? 50))
  const [event, setEvent] = useState(initial?.event_title ?? '')
  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({ chapter, state, trust: trust === '' ? null : Number(trust), event_title: event.trim() || undefined })
  }
  return (
    <form className="record-form" onSubmit={submit} noValidate>
      <p className="field__label">{chapter}장 상태 기록</p>
      <div className="two-col" style={{ gap: 8 }}>
        <label className="field">
          <span className="field__label">관계 상태</span>
          <select className="nl-select" value={state} onChange={(e) => setState(e.target.value)}>
            {RELATION_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">신뢰도 · 0~100</span>
          <input className="char-search" type="number" min={0} max={100} value={trust} onChange={(e) => setTrust(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="field__label">원인 사건 · 선택</span>
        <input className="char-search" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="붉은 문 앞의 다툼" />
      </label>
      <div className="actions-row">
        <Button tone="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" busy={busy}>
          기록
        </Button>
      </div>
    </form>
  )
}

function AddRelationship({
  people,
  chapter,
  onCancel,
  onSubmit,
}: {
  people: Array<{ character_id: string; name: string }>
  chapter: number
  onCancel: () => void
  onSubmit: (input: { source_character_id: string; target_character_id: string; initial_history: api.EntryInput }) => Promise<void>
}) {
  const [a, setA] = useState(people[0]?.character_id ?? '')
  const [b, setB] = useState(people[1]?.character_id ?? '')
  const [first, setFirst] = useState(String(chapter))
  const [state, setState] = useState('우호')
  const [trust, setTrust] = useState('50')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (a === b) return setError('서로 다른 두 인물을 골라 주세요.')
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ source_character_id: a, target_character_id: b, initial_history: { chapter: Number(first), state, trust: Number(trust) } })
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="add-rel-title" onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && onCancel()} noValidate>
        <h2 id="add-rel-title" className="panel__title">
          관계 추가
        </h2>
        <div className="two-col" style={{ gap: 8 }}>
          {[
            ['인물 A', a, setA],
            ['인물 B', b, setB],
          ].map(([label, value, setter]) => (
            <label key={label as string} className="field">
              <span className="field__label">{label as string}</span>
              <select className="nl-select" value={value as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}>
                {people.map((p) => (
                  <option key={p.character_id} value={p.character_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="field">
            <span className="field__label">첫 기록 장</span>
            <input className="char-search" type="number" min={1} value={first} onChange={(e) => setFirst(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">관계 상태</span>
            <select className="nl-select" value={state} onChange={(e) => setState(e.target.value)}>
              {RELATION_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">신뢰도 · 0~100</span>
            <input className="char-search" type="number" min={0} max={100} value={trust} onChange={(e) => setTrust(e.target.value)} />
          </label>
        </div>
        {error && <p className="notice notice--error">{error}</p>}
        <div className="dialog__actions">
          <Button tone="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" busy={busy}>
            관계 추가
          </Button>
        </div>
      </form>
    </div>
  )
}
