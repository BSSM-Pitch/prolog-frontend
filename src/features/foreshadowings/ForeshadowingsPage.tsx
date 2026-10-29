import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as charactersApi from '../../api/characters'
import * as api from '../../api/foreshadowings'
import * as manuscriptsApi from '../../api/manuscripts'
import { IS_REAL } from '../../api/config'
import type { Foreshadowing, SimilarCandidate } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import { InsightNav } from '../insights/InsightNav'
import { InsightDialog } from '../insights/InsightDialog'
import { chapterPosition, foreshadowStages, pageOf, VIEW_LIMIT } from '../insights/insightModel'
import '../characters/characters.css'
import './foreshadowings.css'
import { Select } from '../../components/Select'

type Panel = 'payoff' | 'link' | 'edit' | null
const statusLabel = (item: Foreshadowing) =>
  item.status === 'orphaned'
    ? '심은 장면 없음'
    : item.status === 'resolved'
      ? `${item.payoff_chapter}장 회수`
      : '미회수'

export function ForeshadowingsPage() {
  const project = useProject()
  if (!project) return <p className="page-desc">작품을 불러오고 있어요.</p>
  return (
    <Foreshadowings key={project.project_id} projectId={project.project_id} canEdit={project.my_role !== 'viewer'} />
  )
}

function Foreshadowings({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [params, setParams] = useSearchParams()
  const { withAuth } = useSession()
  const list = useResource((token) => api.listForeshadowings(token, projectId), [projectId])
  const manuscripts = useResource((token) => manuscriptsApi.listManuscripts(token, projectId), [projectId])
  const characters = useResource((token) => charactersApi.listCharacters(token, projectId), [projectId])
  const latest = (manuscripts.data ?? []).find((item) => item.status === 'ready')
  const demoChapters = useResource(
    !IS_REAL && latest ? (token) => manuscriptsApi.listChapters(token, projectId, latest.manuscript_id) : null,
    [projectId, latest?.manuscript_id],
  )
  const current = latest?.chapter_count ?? 1
  const all = list.data ?? []
  const target = all.find((item) => item.foreshadowing_id === params.get('selected'))
  const status = params.get('status') ?? target?.status ?? 'unresolved'
  const character = params.get('character') ?? ''
  const rows = all
    .filter(
      (item) =>
        (status === 'all' || item.status === status) && (!character || item.linked_characters.includes(character)),
    )
    .sort((a, b) => a.setup_chapter - b.setup_chapter)
  const selectedIndex = rows.findIndex((item) => item.foreshadowing_id === target?.foreshadowing_id)
  const page = pageOf(
    rows,
    selectedIndex >= 0 ? Math.floor(selectedIndex / VIEW_LIMIT) + 1 : Number(params.get('page') ?? 1),
  )
  const selected = page.rows.find((item) => item.foreshadowing_id === target?.foreshadowing_id)
  const advisories = useResource(
    selected?.status === 'unresolved' ? (token) => api.listAdvisories(token, projectId, current) : null,
    [projectId, current, selected?.foreshadowing_id, list.data],
  )
  const advice = advisories.data?.find((item) => item.foreshadowing_id === selected?.foreshadowing_id)
  const maxChapter = Math.max(
    1,
    current,
    ...all.flatMap((item) => foreshadowStages(item).map((stage) => stage.chapter)),
  )
  const [panel, setPanel] = useState<Panel>(null)
  const [creating, setCreating] = useState(false)
  const [similar, setSimilar] = useState<SimilarCandidate[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setPanel(null)
    setError(null)
    setParams(next, { replace: true })
  }
  async function act(fn: (token: string) => Promise<unknown>, done?: () => void) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await withAuth(fn)
      list.reload()
      setPanel(null)
      done?.()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }
  function sourceLink(item: Foreshadowing, stage: ReturnType<typeof foreshadowStages>[number]) {
    const source = item.chapter_locations?.find(
      (location) => location.chapter === stage.chapter && location.role === stage.role,
    )
    if (source) return `${projectPath(projectId, `manuscripts/${source.manuscript_id}`)}?chapter=${source.chapter}`
    if (!IS_REAL && latest && demoChapters.data?.some((chapter) => chapter.chapter_no === stage.chapter))
      return `${projectPath(projectId, `manuscripts/${latest.manuscript_id}`)}?chapter=${stage.chapter}`
    return null
  }
  return (
    <div className="fs insight-page">
      <header className="insight-header">
        <h1 className="page-title">복선</h1>
        {canEdit && (
          <Button
            tone="outline"
            onClick={(event) => {
              event.currentTarget.focus()
              setCreating(true)
            }}
          >
            복선 추가
          </Button>
        )}
      </header>
      <InsightNav projectId={projectId} />
      <div className="fs__controls">
        <label className="insight-field">
          <span className="visually-hidden">복선 상태</span>
          <Select value={status} onChange={(event) => set({ status: event.target.value, selected: null, page: null })}>
            <option value="unresolved">미회수</option>
            <option value="resolved">회수 완료</option>
            <option value="all">전체 복선</option>
            {all.some((item) => item.status === 'orphaned') && <option value="orphaned">심은 장면 없음</option>}
          </Select>
        </label>
        {all.some((item) => item.linked_characters.length) && (
          <label className="insight-field">
            <span className="visually-hidden">복선에 연결된 인물</span>
            <Select
              value={character}
              onChange={(event) => set({ character: event.target.value || null, selected: null, page: null })}
            >
              <option value="">모든 인물</option>
              {[...new Set(all.flatMap((item) => item.linked_characters))].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </Select>
          </label>
        )}
      </div>
      {list.loading && !list.data && (
        <p className="insight-state" role="status">
          복선을 불러오고 있어요.
        </p>
      )}
      {list.error && (
        <div className="insight-state" role="alert">
          <p>{list.error}</p>
          <Button tone="outline" onClick={list.reload}>
            다시 불러오기
          </Button>
        </div>
      )}
      {!list.loading && !list.error && !rows.length && (
        <div className="insight-state">
          <h2>{all.length ? '조건에 맞는 복선이 없어요.' : '아직 심어 둔 복선이 없어요.'}</h2>
          {all.length ? (
            <button
              type="button"
              className="text-link"
              onClick={() => set({ status: 'all', character: null, selected: null })}
            >
              전체 복선 보기
            </button>
          ) : (
            <p>나중에 이어질 장면을 기록해 두세요.</p>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <>
          <div className="fs__axis" aria-hidden="true">
            <span>1장</span>
            {maxChapter > 2 && <span>{Math.ceil(maxChapter / 2)}장</span>}
            {maxChapter > 1 && <span>{maxChapter}장</span>}
          </div>
          <ol className="fs__tracks" aria-label="복선 타임라인">
            {page.rows.map((item) => {
              const open = selected?.foreshadowing_id === item.foreshadowing_id
              return (
                <li key={item.foreshadowing_id}>
                  <h2>
                    <button
                      type="button"
                      className="fs__track-toggle"
                      aria-expanded={open}
                      aria-controls={`fs-detail-${item.foreshadowing_id}`}
                      onClick={() => set({ selected: open ? null : item.foreshadowing_id, page: String(page.page) })}
                    >
                      <span className="fs__track-heading">
                        <strong>{item.title}</strong>
                        <span>{statusLabel(item)}</span>
                      </span>
                      <TrackLane item={item} max={maxChapter} current={current} expanded={open} />
                      <span className="visually-hidden">
                        {item.setup_chapter > 0 ? `${item.setup_chapter}장에 심은 복선` : '심은 장면이 없는 복선'}
                      </span>
                    </button>
                  </h2>
                  <div id={`fs-detail-${item.foreshadowing_id}`} hidden={!open}>
                    {open && (
                      <div className="fs__detail">
                        {item.description && <p className="fs__description">{item.description}</p>}
                        <StageList
                          key={item.foreshadowing_id}
                          item={item}
                          sourceLink={(stage) => sourceLink(item, stage)}
                        />
                        {item.linked_characters.length > 0 && (
                          <p className="insight-caption">{item.linked_characters.join(', ')}</p>
                        )}
                        {advice && (
                          <details className="insight-disclosure">
                            <summary>미회수 안내</summary>
                            <p className="page-desc">{advice.message}</p>
                          </details>
                        )}
                        {error && (
                          <p className="insight-note" role="alert">
                            {error}
                          </p>
                        )}
                        {panel === 'payoff' && (
                          <ChapterForm
                            key={`${item.foreshadowing_id}:payoff`}
                            label="회수한 장"
                            hint="복선을 심은 장보다 뒤의 장을 골라 주세요."
                            initial={Math.max(item.setup_chapter + 1, current)}
                            busy={busy}
                            onCancel={() => setPanel(null)}
                            onSubmit={(chapter) =>
                              act(
                                (token) => api.setPayoff(token, projectId, item.foreshadowing_id, chapter),
                                () => set({ status: 'resolved' }),
                              )
                            }
                            submitLabel="회수로 표시"
                          />
                        )}
                        {panel === 'link' && (
                          <ChapterForm
                            key={`${item.foreshadowing_id}:link`}
                            label="이어진 장"
                            hint="이 복선이 다시 등장한 장을 골라 주세요."
                            initial={current}
                            busy={busy}
                            onCancel={() => setPanel(null)}
                            onSubmit={(chapter) =>
                              act((token) => api.addLinkedChapter(token, projectId, item.foreshadowing_id, chapter))
                            }
                            submitLabel="장 연결"
                          />
                        )}
                        {panel === 'edit' && (
                          <EditForm
                            key={item.foreshadowing_id}
                            fs={item}
                            characters={(characters.data ?? []).map((person) => person.name)}
                            busy={busy}
                            onCancel={() => setPanel(null)}
                            onSubmit={(input) =>
                              act((token) => api.updateForeshadowing(token, projectId, item.foreshadowing_id, input))
                            }
                          />
                        )}
                        {canEdit && panel === null && (
                          <div className="insight-actions">
                            {item.status === 'unresolved' && (
                              <Button tone="outline" onClick={() => setPanel('payoff')}>
                                회수한 장 지정
                              </Button>
                            )}
                            <button type="button" className="text-link" onClick={() => setPanel('link')}>
                              장 연결
                            </button>
                            <button type="button" className="text-link" onClick={() => setPanel('edit')}>
                              수정
                            </button>
                            <details className="insight-disclosure">
                              <summary>관리</summary>
                              <div className="fs__manage">
                                {item.status === 'resolved' && (
                                  <button
                                    type="button"
                                    className="text-link"
                                    disabled={busy}
                                    onClick={() =>
                                      act(
                                        (token) => api.cancelPayoff(token, projectId, item.foreshadowing_id),
                                        () => set({ status: 'unresolved' }),
                                      )
                                    }
                                  >
                                    회수 취소
                                  </button>
                                )}
                                {[...new Set(item.linked_chapters)].map((chapter) => (
                                  <button
                                    key={chapter}
                                    type="button"
                                    className="text-link"
                                    disabled={busy}
                                    onClick={() =>
                                      act((token) =>
                                        api.removeLinkedChapter(token, projectId, item.foreshadowing_id, chapter),
                                      )
                                    }
                                  >
                                    {chapter}장 연결 해제
                                  </button>
                                ))}
                                <button type="button" className="text-link" onClick={() => setConfirmDelete(true)}>
                                  복선 삭제
                                </button>
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
          {page.count > 1 && (
            <nav className="insight-pagination" aria-label="복선 목록 페이지">
              <Button
                tone="outline"
                disabled={page.page === 1}
                onClick={() => set({ page: String(page.page - 1), selected: null })}
              >
                이전 복선
              </Button>
              <span>
                {page.page} / {page.count}
              </span>
              <Button
                tone="outline"
                disabled={page.page === page.count}
                onClick={() => set({ page: String(page.page + 1), selected: null })}
              >
                다음 복선
              </Button>
            </nav>
          )}
        </>
      )}
      <p className="insight-caption">저장한 복선 기준 · 점선은 아직 회수하지 않은 구간이에요.</p>
      {creating && (
        <CreateDialog
          characters={(characters.data ?? []).map((person) => person.name)}
          defaultChapter={current}
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            const result = await withAuth((token) => api.createForeshadowing(token, projectId, input))
            list.setData((previous) => [...(previous ?? []), result.data])
            setCreating(false)
            set({ selected: result.data.foreshadowing_id, status: 'unresolved', character: null, page: null })
            if (result.meta.similar_candidates?.length) setSimilar(result.meta.similar_candidates)
          }}
        />
      )}
      {similar.length > 0 && (
        <InsightDialog title="비슷한 복선이 있어요" onClose={() => setSimilar([])}>
          <p className="page-desc">새 복선은 저장했어요. 기존 복선도 살펴보세요.</p>
          <div className="fs__manage">
            {similar.map((item) => (
              <button
                type="button"
                className="text-link"
                key={item.foreshadowing_id}
                onClick={() => {
                  set({ selected: item.foreshadowing_id, status: 'all', character: null })
                  setSimilar([])
                }}
              >
                {item.title} 보기
              </button>
            ))}
          </div>
          <Button tone="outline" onClick={() => setSimilar([])}>
            닫기
          </Button>
        </InsightDialog>
      )}
      {confirmDelete && selected && (
        <InsightDialog title="복선을 삭제할까요?" busy={busy} onClose={() => setConfirmDelete(false)}>
          <p>‘{selected.title}’의 기록이 사라져요. 원고 본문은 남아요.</p>
          {error && <p role="alert">{error}</p>}
          <div className="insight-actions">
            <Button tone="outline" disabled={busy} autoFocus onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
            <Button
              tone="error"
              busy={busy}
              onClick={() =>
                act(
                  (token) => api.deleteForeshadowing(token, projectId, selected.foreshadowing_id),
                  () => {
                    setConfirmDelete(false)
                    set({ selected: null })
                  },
                )
              }
            >
              삭제
            </Button>
          </div>
        </InsightDialog>
      )}
    </div>
  )
}

function TrackLane({
  item,
  max,
  current,
  expanded,
}: {
  item: Foreshadowing
  max: number
  current: number
  expanded: boolean
}) {
  if (item.status === 'orphaned' || item.setup_chapter < 1)
    return <span className="fs__missing">심은 장면을 다시 지정해 주세요.</span>
  const start = chapterPosition(item.setup_chapter, max)
  const end = chapterPosition(
    item.payoff_chapter ?? Math.max(item.setup_chapter, current, ...item.linked_chapters),
    max,
  )
  return (
    <span className="fs__lane" aria-hidden="true">
      <span
        className={`fs__range${item.status === 'unresolved' ? ' is-open' : ''}`}
        style={{ left: `${start}%`, width: `${Math.max(0, end - start)}%` }}
      />
      <span className="fs__dot" style={{ left: `${start}%` }} />
      {expanded &&
        [...new Set(item.linked_chapters)]
          .filter((chapter) => chapter > 0)
          .map((chapter) => (
            <span
              key={chapter}
              className="fs__dot fs__dot--linked"
              style={{ left: `${chapterPosition(chapter, max)}%` }}
            />
          ))}
      {item.payoff_chapter !== null && <span className="fs__dot fs__dot--payoff" style={{ left: `${end}%` }} />}
    </span>
  )
}

function StageList({
  item,
  sourceLink,
}: {
  item: Foreshadowing
  sourceLink: (stage: ReturnType<typeof foreshadowStages>[number]) => string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const stages = foreshadowStages(item)
  return (
    <div className="fs__stages">
      <ol>
        {(expanded ? stages : stages.slice(0, 6)).map((stage) => {
          const href = sourceLink(stage)
          return (
            <li key={`${stage.role}:${stage.chapter}`}>
              <span>{stage.label}</span>
              {href ? (
                <Link className="text-link" to={href}>
                  {stage.chapter}장 원문
                </Link>
              ) : (
                <strong>{stage.chapter}장</strong>
              )}
            </li>
          )
        })}
      </ol>
      {stages.length > 6 && (
        <button type="button" className="text-link" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? '접기' : `장면 ${stages.length - 6}개 더 보기`}
        </button>
      )}
    </div>
  )
}
function ChapterForm({
  label,
  hint,
  initial,
  busy,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  label: string
  hint: string
  initial: number
  busy: boolean
  submitLabel: string
  onCancel: () => void
  onSubmit: (c: number) => void
}) {
  const [value, setValue] = useState(String(initial))
  return (
    <form
      className="record-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!busy) onSubmit(Number(value))
      }}
    >
      <label className="field">
        <span className="field__label">{label}</span>
        <input
          className="char-search"
          type="number"
          min={1}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <span className="panel__label">{hint}</span>
      </label>
      <div className="actions-row">
        <Button tone="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" busy={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function EditForm({
  fs,
  characters,
  busy,
  onCancel,
  onSubmit,
}: {
  fs: Foreshadowing
  characters: string[]
  busy: boolean
  onCancel: () => void
  onSubmit: (i: { title: string; description: string; setup_chapter: number; linked_characters: string[] }) => void
}) {
  const [title, setTitle] = useState(fs.title)
  const [description, setDescription] = useState(fs.description)
  const [setup, setSetup] = useState(String(fs.setup_chapter))
  const [people, setPeople] = useState<string[]>(fs.linked_characters)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      setup_chapter: Number(setup),
      linked_characters: people,
    })
  }
  return (
    <form className="record-form" onSubmit={submit}>
      <FsFields
        title={title}
        setTitle={setTitle}
        description={description}
        setDescription={setDescription}
        setup={setup}
        setSetup={setSetup}
        characters={characters}
        people={people}
        setPeople={setPeople}
      />
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

function CreateDialog({
  characters,
  defaultChapter,
  onCancel,
  onSubmit,
}: {
  characters: string[]
  defaultChapter: number
  onCancel: () => void
  onSubmit: (i: {
    title: string
    description: string
    setup_chapter: number
    linked_characters: string[]
  }) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [setup, setSetup] = useState(String(defaultChapter))
  const [people, setPeople] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!title.trim()) return setError('복선 제목을 입력해 주세요.')
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        setup_chapter: Number(setup),
        linked_characters: people,
      })
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }
  return (
    <InsightDialog title="복선 추가" onClose={onCancel} busy={busy}>
      <form className="insight-form" onSubmit={submit}>
        <FsFields
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          setup={setup}
          setSetup={setSetup}
          characters={characters}
          people={people}
          setPeople={setPeople}
        />
        {error && <p className="notice notice--error">{error}</p>}
        <div className="dialog__actions">
          <Button tone="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" busy={busy}>
            복선 생성
          </Button>
        </div>
      </form>
    </InsightDialog>
  )
}

interface FsFieldsProps {
  title: string
  setTitle: (v: string) => void
  description: string
  setDescription: (v: string) => void
  setup: string
  setSetup: (v: string) => void
  characters: string[]
  people: string[]
  setPeople: (v: string[]) => void
}

function FsFields({
  title,
  setTitle,
  description,
  setDescription,
  setup,
  setSetup,
  characters,
  people,
  setPeople,
}: FsFieldsProps) {
  return (
    <>
      <label className="field">
        <span className="field__label">제목</span>
        <input
          className="char-search"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="붉은 문의 열쇠"
          autoFocus
        />
      </label>
      <label className="field">
        <span className="field__label">설명 · 선택</span>
        <input
          className="char-search"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="나중에 어떻게 이어질지 적어 두세요"
        />
      </label>
      <label className="field">
        <span className="field__label">심은 장</span>
        <input
          className="char-search"
          type="number"
          min={1}
          required
          value={setup}
          onChange={(e) => setSetup(e.target.value)}
        />
      </label>
      {characters.length > 0 && (
        <fieldset className="fs__people">
          <legend className="field__label">관련 인물</legend>
          {characters.map((c) => (
            <label key={c} className="chip fs__person">
              <input
                type="checkbox"
                checked={people.includes(c)}
                onChange={(e) => setPeople(e.target.checked ? [...people, c] : people.filter((p) => p !== c))}
              />
              {c}
            </label>
          ))}
        </fieldset>
      )}
    </>
  )
}
