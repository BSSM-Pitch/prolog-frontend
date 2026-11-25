import { SourceReviewBadge, SourceReviewNotice } from '../insights/SourceReviewNotice'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as charactersApi from '../../api/characters'
import { ApiError } from '../../api/client'
import { IS_REAL } from '../../api/config'
import type { Manuscript } from '../../api/types'
import * as manuscriptsApi from '../../api/manuscripts'
import * as api from '../../api/relationships'
import { RELATION_STATES } from '../../api/relationships'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import { InsightNav } from '../insights/InsightNav'
import { AddRelationship } from './AddRelationship'
import { NarrativeReview } from '../insights/NarrativeReview'
import { InsightDialog } from '../insights/InsightDialog'
import { chapterAt, relationshipView, snapshotAt, toneOf } from '../insights/insightModel'
import { RelationshipGraph } from './RelationshipGraph'
import '../characters/characters.css'
import './relationships.css'
import { Select } from '../../components/Select'

type Pending = { relationshipId: string; entry: api.EntryInput; existing: { state: string; trust: number | null } }

export function RelationshipsPage() {
  const project = useProject()
  const [params, setParams] = useSearchParams()
  const manuscripts = useResource(
    project ? (token) => manuscriptsApi.listManuscripts(token, project.project_id) : null,
    [project?.project_id],
  )
  const manuscriptId = (
    manuscripts.data?.find((item) => item.manuscript_id === params.get('manuscript')) ?? manuscripts.data?.[0]
  )?.manuscript_id
  useEffect(() => {
    if (manuscripts.loading || !manuscriptId || params.get('manuscript') === manuscriptId) return
    const next = new URLSearchParams(params)
    next.set('manuscript', manuscriptId)
    setParams(next, { replace: true })
  }, [manuscriptId, manuscripts.loading, params, setParams])
  if (!project) return <p className="page-desc">작품을 불러오고 있어요.</p>
  if (manuscripts.error)
    return (
      <div className="insight-state" role="alert">
        <p>{manuscripts.error}</p>
        <Button onClick={manuscripts.reload}>다시 불러오기</Button>
      </div>
    )
  if (manuscripts.loading) return <p className="insight-state">원고를 불러오고 있어요.</p>
  if (!manuscriptId)
    return (
      <div className="insight-state">
        <h1>먼저 원고를 만들어 주세요.</h1>
        <Link to={projectPath(project.project_id, 'manuscripts')}>원고 열기</Link>
      </div>
    )
  return (
    <Relationships
      key={`${project.project_id}:${manuscriptId}`}
      projectId={project.project_id}
      canEdit={project.my_role !== 'viewer'}
      manuscriptId={manuscriptId}
      manuscripts={manuscripts.data ?? []}
    />
  )
}

function Relationships({
  projectId,
  canEdit,
  manuscriptId,
  manuscripts,
}: {
  projectId: string
  canEdit: boolean
  manuscriptId: string
  manuscripts: Manuscript[]
}) {
  const [params, setParams] = useSearchParams()
  const { withAuth } = useSession()
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const rels = useResource((token) => api.listRelationships(token, projectId, manuscriptId), [projectId, manuscriptId])
  const refreshRecords = rels.reload
  useEffect(() => {
    const refresh = (event: Event) => { if ((event as CustomEvent).detail === projectId) refreshRecords() }
    window.addEventListener('narrative-adopted', refresh)
    window.addEventListener('focus', refreshRecords)
    return () => {
      window.removeEventListener('narrative-adopted', refresh)
      window.removeEventListener('focus', refreshRecords)
    }
  }, [projectId, refreshRecords])
  const characters = useResource((token) => charactersApi.listCharacters(token, projectId), [projectId])
  const chapters = useResource(
    (token) => manuscriptsApi.listChapters(token, projectId, manuscriptId),
    [projectId, manuscriptId],
  )
  const list = rels.data ?? []
  const people = characters.data ?? []
  const maxChapter = Math.max(
    1,
    ...(chapters.data ?? []).map((item) => item.chapter_no),
    ...list.flatMap((item) => item.history.map((entry) => entry.chapter)),
  )
  const chapter = chapterAt(Number(params.get('chapter')), maxChapter)
  const linkedRelationship = list.find((item) => item.relationship_id === params.get('rel'))
  const view = relationshipView(people, list, chapter, params.get('character') ?? linkedRelationship?.source_character_id ?? null, Number(params.get('page') ?? 1))
  const selected =
    view.neighbors.find((item) => item.relationship.relationship_id === params.get('rel'))?.relationship ?? null
  const snapshot = selected ? snapshotAt(selected, chapter) : null
  const selectedRelationshipId = selected?.relationship_id
  const detail = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!selectedRelationshipId) return
    // 넓은 화면에서는 오른쪽에 붙어 있어 옮길 필요가 없고, 좁은 화면에서만 아래 상세로 내려 준다
    if (window.matchMedia('(max-width: 1100px)').matches) detail.current?.scrollIntoView({ block: 'nearest' })
    detail.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }, [selectedRelationshipId, chapter])
  const [recording, setRecording] = useState(false)
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const nameOf = (id: string) => people.find((person) => person.character_id === id)?.name ?? '이름 없는 인물'
  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setRecording(false)
    setError(null)
    setParams(next, { replace: true })
  }
  async function saveRecord(relationshipId: string, entry: api.EntryInput, overwrite = false) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const updated = await withAuth((token) =>
        api.recordState(token, projectId, relationshipId, entry, overwrite, manuscriptId),
      )
      if (!active.current) return
      rels.setData(
        (old) => old?.map((item) => (item.relationship_id === updated.relationship_id ? updated : item)) ?? null,
      )
      setPending(null)
      setRecording(false)
      setNotice(`${entry.chapter}장 관계를 기록했어요.`)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_CHAPTER_RECORD')
        setPending({ relationshipId, entry, existing: err.details.existing_entry as Pending['existing'] })
      else setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }
  async function removeRelationship() {
    if (!selected || busy) return
    setBusy(true)
    try {
      await withAuth((token) => api.deleteRelationship(token, projectId, selected.relationship_id))
      if (!active.current) return
      rels.setData((old) => old?.filter((item) => item.relationship_id !== selected.relationship_id) ?? null)
      setConfirmDelete(false)
      set({ rel: null })
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }
  const loading =
    (rels.loading && !rels.data) || (characters.loading && !characters.data) || (chapters.loading && !chapters.data)
  const loadError = rels.error ?? characters.error ?? chapters.error

  const addBlocked = !canEdit || loading || loadError
    ? null
    : people.length < 2
      ? '인물이 두 명 이상 있어야 관계를 추가할 수 있어요.'
      : !chapters.data?.length
        ? '원고에 장이 있어야 관계를 기록할 수 있어요.'
        : null
  const history = selected ? [...selected.history].sort((a, b) => a.chapter - b.chapter) : []

  return (
    <div className="relations insight-page">
      <header className="insight-header">
        <h1 className="page-title">인물 관계</h1>
        <div className="insight-actions">
          <label className="insight-field">
            <span>원고</span>
            <Select
              aria-label="관계를 기록할 원고"
              value={manuscriptId}
              disabled={busy || adding}
              onChange={(event) => set({ manuscript: event.target.value, chapter: null, rel: null, page: null, relationships_review: null })}
            >
              {manuscripts.map((item) => (
                <option key={item.manuscript_id} value={item.manuscript_id}>
                  {item.title}
                </option>
              ))}
            </Select>
          </label>
          {canEdit && (
            <Button
              disabled={Boolean(addBlocked) || loading || !!loadError}
              onClick={(event) => {
                event.currentTarget.focus()
                setAdding(true)
              }}
            >
              관계 추가
            </Button>
          )}
        </div>
      </header>
      <InsightNav projectId={projectId} />
      {addBlocked && people.length > 0 && <p className="insight-note">{addBlocked}</p>}
      {notice && (
        <p className="notice notice--success" role="status">
          {notice}
        </p>
      )}
      {loadError && (
        <div className="insight-state" role="alert">
          <p>{loadError}</p>
          <Button
            tone="outline"
            onClick={() => {
              rels.reload()
              characters.reload()
              chapters.reload()
            }}
          >
            다시 불러오기
          </Button>
        </div>
      )}
      {loading ? (
        <p className="insight-state" role="status">
          관계를 불러오고 있어요.
        </p>
      ) : !loadError && people.length === 0 ? (
        <div className="insight-state">
          <h2>등장인물이 아직 없어요.</h2>
          <p>인물을 두 명 이상 만들면 둘 사이의 관계를 장마다 기록할 수 있어요.</p>
          <Link className="btn btn--primary" to={projectPath(projectId, 'characters')}>
            등장인물 만들기
          </Link>
        </div>
      ) : (
        !loadError && (
          <div className={`relations__layout${selected && snapshot ? ' has-detail' : ''}`}>
            <div className="relations__main">
              <div className="relations__controls">
                <label className="insight-field">
                  <span>가운데 인물</span>
                  <Select
                    value={view.center?.character_id ?? ''}
                    onChange={(event) => set({ character: event.target.value, rel: null, page: null })}
                  >
                    {people.map((person) => (
                      <option key={person.character_id} value={person.character_id}>
                        {person.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="relations__chapter">
                  <label htmlFor="relations-chapter">
                    <strong>{chapter}장</strong> 시점 <span>/ 전체 {maxChapter}장</span>
                  </label>
                  <input
                    id="relations-chapter"
                    type="range"
                    min={1}
                    max={maxChapter}
                    value={chapter}
                    list="relations-chapter-ticks"
                    onChange={(event) => set({ chapter: event.target.value, page: null })}
                  />
                  <datalist id="relations-chapter-ticks">
                    {Array.from({ length: maxChapter }, (_, i) => (
                      <option key={i} value={i + 1} />
                    ))}
                  </datalist>
                  {chapter < maxChapter && (
                    <button type="button" className="text-link" onClick={() => set({ chapter: null, page: null })}>
                      마지막 장으로
                    </button>
                  )}
                </div>
              </div>
              {view.neighbors.length ? (
                <>
                  <p className="insight-caption">
                    선 위의 관계를 누르면 기록이 열리고, 인물을 누르면 그 인물이 가운데로 와요.
                    {!IS_REAL && ' (시연용 기록)'}
                  </p>
                  <RelationshipGraph
                    view={view}
                    selectedId={selected?.relationship_id ?? null}
                    onPerson={(id) => set({ character: id, rel: null, page: null })}
                    onRelationship={(id) => set({ rel: selected?.relationship_id === id ? null : id })}
                  />
                </>
              ) : (
                <div className="insight-state">
                  <h2>{chapter}장까지 {view.center?.name}의 관계 기록이 없어요.</h2>
                  <p>다른 인물을 가운데에 두거나, 장을 옮겨 보세요.</p>
                </div>
              )}
              {view.count > 1 && (
                <nav className="insight-pagination" aria-label="연결된 인물 페이지">
                  <Button
                    tone="outline"
                    disabled={view.page === 1}
                    onClick={() => set({ page: String(view.page - 1), rel: null })}
                  >
                    이전 인물
                  </Button>
                  <span>
                    {view.page} / {view.count}
                  </span>
                  <Button
                    tone="outline"
                    disabled={view.page === view.count}
                    onClick={() => set({ page: String(view.page + 1), rel: null })}
                  >
                    다음 인물
                  </Button>
                </nav>
              )}
            </div>
            {selected && snapshot ? (
              <aside
                key={`${selected.relationship_id}:${chapter}`}
                className="relations__detail"
                ref={detail}
                aria-label="선택한 관계"
              >
                <header className="relations__detail-head">
                  <h2 tabIndex={-1}>
                    {nameOf(selected.source_character_id)} · {nameOf(selected.target_character_id)}
                  </h2>
                  <button type="button" className="text-link" onClick={() => set({ rel: null })}>
                    닫기
                  </button>
                </header>
                <SourceReviewNotice review={snapshot.source_review} projectId={projectId} canEdit={canEdit}
                  endpoint={`/projects/${projectId}/relationships/${selected.relationship_id}/history/${snapshot.chapter_id}/source-confirmation`}
                  onSaved={refreshRecords} />
                <div className="relations__state">
                  <span className="relations__label">{chapter}장 시점</span>
                  <strong data-tone={toneOf(snapshot.state)}>{snapshot.state}</strong>
                  {snapshot.trust !== null && <span>신뢰도 {snapshot.trust}</span>}
                  {snapshot.chapter !== chapter && <span>{snapshot.chapter}장에 기록한 상태예요</span>}
                </div>
                {snapshot.event_title && (
                  <p className="relations__event">
                    {snapshot.event_title}
                    {snapshot.event_deleted ? ' (연결된 사건은 지워졌어요)' : ''}
                  </p>
                )}
                {canEdit &&
                  (recording ? (
                    <RecordForm
                      key={`${selected.relationship_id}:${chapter}`}
                      chapter={chapter}
                      initial={{ ...snapshot, event_title: snapshot.chapter === chapter ? snapshot.event_title : null }}
                      busy={busy}
                      onCancel={() => setRecording(false)}
                      onSubmit={(entry) => saveRecord(selected.relationship_id, entry)}
                    />
                  ) : (
                    <Button
                      block
                      disabled={IS_REAL && !chapters.data?.some((item) => item.chapter_no === chapter)}
                      onClick={() => setRecording(true)}
                    >
                      {snapshot.chapter === chapter ? `${chapter}장 기록 고치기` : `${chapter}장 관계 기록하기`}
                    </Button>
                  ))}
                {error && (
                  <p className="notice notice--error" role="alert">
                    {error}
                  </p>
                )}
                <section className="relations__timeline" aria-label="장별 변화">
                  <h3>장별 변화 {history.length}개</h3>
                  <ol>
                    {history.map((entry) => (
                      <li key={entry.chapter} className={entry.chapter > chapter ? 'is-later' : undefined}>
                        <button
                          type="button"
                          aria-current={entry.chapter === snapshot.chapter ? 'step' : undefined}
                          onClick={() => set({ chapter: String(entry.chapter) })}
                        >
                          <span className="relations__timeline-chapter">{entry.chapter}장</span>
                          <span className="relations__timeline-body">
                            <strong data-tone={toneOf(entry.state)}>{entry.state}</strong>
                            {entry.trust !== null && <span>신뢰도 {entry.trust}</span>}
                            <SourceReviewBadge review={entry.source_review} />
                            {entry.event_title && <em>{entry.event_title}</em>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
                {canEdit && (
                  <button type="button" className="text-link text-link--quiet text-link--danger relations__delete" onClick={() => setConfirmDelete(true)}>
                    이 관계 삭제
                  </button>
                )}
              </aside>
            ) : (
              view.neighbors.length > 0 && (
                <aside className="relations__detail relations__detail--empty">
                  <p>선 위의 관계를 누르면 장별 변화와 기록이 여기에 열려요.</p>
                </aside>
              )
            )}
          </div>
        )
      )}
      <NarrativeReview key={manuscriptId} {...{projectId, manuscriptId, canEdit}} kind="relationships" />
      {pending && (
        <InsightDialog
          title={`${pending.entry.chapter}장 기록을 바꿀까요?`}
          busy={busy}
          onClose={() => setPending(null)}
        >
          <p>
            {pending.existing.state} → {pending.entry.state}
          </p>
          <p className="page-desc">이 장에 이미 기록이 있어요. 새 값으로 바꾸면 이전 값은 남지 않아요.</p>
          {error && <p className="notice notice--error" role="alert">{error}</p>}
          <div className="dialog__actions">
            <Button tone="outline" onClick={() => setPending(null)} disabled={busy} autoFocus>
              취소
            </Button>
            <Button busy={busy} onClick={() => saveRecord(pending.relationshipId, pending.entry, true)}>
              기록 바꾸기
            </Button>
          </div>
        </InsightDialog>
      )}
      {adding && (
        <AddRelationship
          projectId={projectId}
          manuscriptId={manuscriptId}
          chapterRows={chapters.data ?? []}
          people={people}
          chapter={chapter}
          chapters={(chapters.data ?? []).map((item) => item.chapter_no)}
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            const item = await withAuth((token) => api.createRelationship(token, projectId, input, manuscriptId))
            if (!active.current) return
            rels.setData((old) => [...(old ?? []).filter((row) => row.relationship_id !== item.relationship_id), item])
            setAdding(false)
            set({
              character: item.source_character_id,
              rel: item.relationship_id,
              chapter: String(input.initial_history.chapter),
              page: null,
            })
          }}
        />
      )}
      {confirmDelete && selected && (
        <InsightDialog title="관계를 삭제할까요?" busy={busy} onClose={() => setConfirmDelete(false)}>
          <p>
            {nameOf(selected.source_character_id)}와 {nameOf(selected.target_character_id)}의 모든 원고에 걸친 관계
            기록이 사라져요.
          </p>
          {error && <p className="notice notice--error" role="alert">{error}</p>}
          <div className="dialog__actions">
            <Button tone="outline" onClick={() => setConfirmDelete(false)} disabled={busy} autoFocus>
              취소
            </Button>
            <Button tone="error" onClick={removeRelationship} busy={busy}>
              삭제
            </Button>
          </div>
        </InsightDialog>
      )}
    </div>
  )
}
function RecordForm({
  chapter,
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  chapter: number
  initial: { state: string; trust: number | null; event_title: string | null } | null
  busy: boolean
  onCancel: () => void
  onSubmit: (e: api.EntryInput) => void
}) {
  const [state, setState] = useState(initial?.state ?? '중립')
  const [trust, setTrust] = useState(initial?.trust == null ? '' : String(initial.trust))
  const [event, setEvent] = useState(initial?.event_title ?? '')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    onSubmit({ chapter, state, trust: trust === '' ? null : Number(trust), event_title: event.trim() || undefined })
  }
  return (
    <form className="record-form" onSubmit={submit}>
      <p className="field__label">{chapter}장 상태 기록</p>
      <div className="two-col form-grid">
        <label className="field">
          <span className="field__label">관계 상태</span>
          <Select className="nl-select" value={state} onChange={(e) => setState(e.target.value)}>
            {RELATION_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </label>
        <label className="field">
          <span className="field__label">신뢰도 · 선택 · 0~100</span>
          <input
            className="char-search"
            type="number"
            min={0}
            max={100}
            value={trust}
            onChange={(e) => setTrust(e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span className="field__label">관계 변화 메모 · 선택</span>
        <input
          className="char-search"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="붉은 문 앞의 다툼"
        />
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
