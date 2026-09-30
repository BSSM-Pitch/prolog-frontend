import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as charactersApi from '../../api/characters'
import * as api from '../../api/foreshadowings'
import * as manuscriptsApi from '../../api/manuscripts'
import type { Foreshadowing, SimilarCandidate } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { describeError } from '../../lib/errors'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import '../characters/characters.css'
import '../manuscripts/answer.css'
import '../world/world.css'
import '../relationships/relationships.css'
import './foreshadowings.css'

type Panel = 'payoff' | 'link' | 'edit' | null
const PRIORITY = { high: '높음', medium: '보통', low: '낮음' } as const

// Figma 843:1394 · 04 복선 추적 / 843:1534 · 24 복선 타임라인 (+ 상태 명세 1264:3150 FTS 행)
export function ForeshadowingsPage() {
  const project = useProject()
  const [params, setParams] = useSearchParams()
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const list = useResource(project ? (t) => api.listForeshadowings(t, projectId) : null, [projectId])
  const manuscripts = useResource(project ? (t) => manuscriptsApi.listManuscripts(t, projectId) : null, [projectId])
  const characters = useResource(project ? (t) => charactersApi.listCharacters(t, projectId) : null, [projectId])
  const latest = (manuscripts.data ?? []).filter((m) => m.status === 'ready')[0] ?? null
  const current = latest?.chapter_count ?? 1
  const advisories = useResource(project ? (t) => api.listAdvisories(t, projectId, current) : null, [projectId, current, list.data])

  const [panel, setPanel] = useState<Panel>(null)
  const [creating, setCreating] = useState(false)
  const [similar, setSimilar] = useState<{ created: Foreshadowing; candidates: SimilarCandidate[] } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAdvice, setShowAdvice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>
  const canEdit = project.my_role !== 'viewer'
  const view = params.get('view') === 'timeline' ? 'timeline' : 'list'
  const statusFilter = params.get('status') ?? ''
  const charFilter = params.get('character') ?? ''
  const all = list.data ?? []
  const rows = all.filter((f) => (!statusFilter || f.status === statusFilter) && (!charFilter || f.linked_characters.includes(charFilter)))
  const selected = all.find((f) => f.foreshadowing_id === params.get('selected')) ?? rows[0] ?? null
  const advice = (advisories.data ?? []).find((a) => a.foreshadowing_id === selected?.foreshadowing_id) ?? null
  const unresolved = all.filter((f) => f.status === 'unresolved').length
  const maxChapter = Math.max(current, ...all.flatMap((f) => [f.setup_chapter, ...f.linked_chapters, f.payoff_chapter ?? 0])) + 3

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  async function act(fn: (token: string) => Promise<unknown>, done?: () => void) {
    setBusy(true)
    setError(null)
    try {
      await withAuth(fn)
      list.reload()
      setPanel(null)
      done?.()
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const editorLink = (chapter: number) => (latest ? `${projectPath(projectId, `manuscripts/${latest.manuscript_id}`)}?chapter=${chapter}` : null)

  return (
    <div className="fs">
      <header>
        <p className="page-crumb">이야기 줄기 관리 / 서사적 부채</p>
        <h1 className="page-title">{view === 'timeline' ? '복선 타임라인' : '복선 추적'}</h1>
        <p className="page-desc">{view === 'timeline' ? '설치·연결·회수 장면을 장 단위로 추적하세요.' : '직접 지정한 복선의 설치–연결–회수 흐름을 관리하세요.'}</p>
      </header>

      <section className="fs__summary" aria-label="복선 현황">
        <button type="button" className="panel fs__metric" onClick={() => set({ status: 'unresolved' })}>
          <span className="panel__label">미회수</span>
          <strong>{unresolved}건</strong>
          <span className="panel__label">회수 장면 확인</span>
        </button>
        <button type="button" className="panel fs__metric" onClick={() => set({ status: 'resolved' })}>
          <span className="panel__label">회수 완료</span>
          <strong>{all.filter((f) => f.status === 'resolved').length}건</strong>
          <span className="panel__label">완성된 연결</span>
        </button>
        <button type="button" className="panel fs__metric" onClick={() => setShowAdvice((v) => !v)} aria-expanded={showAdvice}>
          <span className="panel__label">미회수 안내</span>
          <strong>{(advisories.data ?? []).filter((a) => a.priority === 'high').length}건 높음</strong>
          <span className="panel__label">{showAdvice ? '안내 접기' : '미회수 안내 보기'}</span>
        </button>
      </section>

      {showAdvice && (
        <section className="panel" aria-labelledby="advice-title">
          <h2 id="advice-title" className="panel__title">
            미회수 안내 · 현재 {current}장 기준
          </h2>
          {(advisories.data ?? []).length === 0 ? (
            <div className="state-block">
              <p className="answer__title">남은 복선이 없어요</p>
              <p className="answer__body">설치한 복선이 모두 회수됐어요.</p>
            </div>
          ) : (
            <ul className="changes">
              {advisories.data!.map((a) => (
                <li key={a.foreshadowing_id}>
                  <span className={`priority priority--${a.priority}`}>{PRIORITY[a.priority]}</span> {a.message}{' '}
                  <button type="button" className="text-link" onClick={() => set({ selected: a.foreshadowing_id })}>
                    선택
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="fs__layout">
        <section className="panel" aria-labelledby="fs-list-title">
          <div className="relations__toolbar">
            <h2 id="fs-list-title" className="panel__title">
              {view === 'timeline' ? `복선 타임라인 / 1–${maxChapter}장` : '복선 목록'}
            </h2>
            <select className="nl-select" value={statusFilter} onChange={(e) => set({ status: e.target.value })} aria-label="상태 필터">
              <option value="">상태 · 전체</option>
              <option value="unresolved">미회수</option>
              <option value="resolved">회수 완료</option>
              {all.some((f) => f.status === 'orphaned') && <option value="orphaned">설치 장 삭제됨</option>}
            </select>
            <select className="nl-select" value={charFilter} onChange={(e) => set({ character: e.target.value })} aria-label="인물 필터">
              <option value="">연결 대상 · 전체</option>
              {[...new Set(all.flatMap((f) => f.linked_characters))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <Button tone="soft" onClick={() => set({ view: view === 'timeline' ? null : 'timeline' })}>
              {view === 'timeline' ? '목록 보기' : '타임라인 보기'}
            </Button>
          </div>

          {list.data && rows.length === 0 && (
            <div className="state-block">
              <p className="answer__title">{all.length === 0 ? '아직 등록한 복선이 없어요' : '조건에 맞는 복선이 없어요'}</p>
              <p className="answer__body">{all.length === 0 ? '원고에서 나중에 이어질 장면을 복선으로 표시해 두세요.' : '필터를 바꿔 보세요.'}</p>
            </div>
          )}

          {view === 'list' ? (
            <ul className="char-list">
              {rows.map((f) => (
                <li key={f.foreshadowing_id}>
                  <button type="button" className="char-item" aria-current={selected?.foreshadowing_id === f.foreshadowing_id || undefined} onClick={() => (setPanel(null), set({ selected: f.foreshadowing_id }))}>
                    <span className="char-item__name">
                      {f.code} · {f.title} <StatusBadge status={f.status} resolved="회수" />
                    </span>
                    <span className="char-item__meta">{f.description}</span>
                    <span className="fs__chips">
                      <span className="fs-chip fs-chip--setup">{f.status === 'orphaned' ? '설치 장 없음' : `설치 ${f.setup_chapter}장`}</span>
                      {f.linked_chapters.map((c) => (
                        <span key={c} className="fs-chip fs-chip--linked">
                          연결 {c}장
                        </span>
                      ))}
                      {f.payoff_chapter && <span className="fs-chip fs-chip--payoff">회수 {f.payoff_chapter}장</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <TrackView rows={rows} max={maxChapter} current={current} selectedId={selected?.foreshadowing_id ?? null} onSelect={(id) => (setPanel(null), set({ selected: id }))} />
          )}

          {canEdit && (
            <Button block onClick={() => setCreating(true)}>
              + 복선 생성
            </Button>
          )}
        </section>

        {selected && (
          <section className="panel fs__detail" aria-labelledby="fs-title">
            <p className="panel__label">
              선택한 복선 / {selected.code}
              {selected.status === 'unresolved' && selected.linked_chapters.length > 0 && ` · 마지막 연결 ${Math.max(...selected.linked_chapters)}장`}
              {selected.status === 'unresolved' && ' · 열린 트랙'}
            </p>
            <div className="world__list-head">
              <h2 id="fs-title" className="page-title">
                {selected.title}
              </h2>
              <StatusBadge status={selected.status} resolved="회수 완료" />
            </div>
            {selected.description && <p className="page-desc">{selected.description}</p>}

            <ol className="fs-steps">
              <li className="fs-steps__item fs-steps__item--setup">
                <span>설치</span> {selected.status === 'orphaned' ? '설치 장이 지워졌어요. 수정에서 다시 골라 주세요.' : `${selected.setup_chapter}장`}
                {selected.status !== 'orphaned' && editorLink(selected.setup_chapter) && (
                  <Link className="text-link" to={editorLink(selected.setup_chapter)!}>
                    원문 보기
                  </Link>
                )}
              </li>
              {selected.linked_chapters.map((c) => (
                <li key={c} className="fs-steps__item fs-steps__item--linked">
                  <span>연결</span> {c}장
                  {editorLink(c) && (
                    <Link className="text-link" to={editorLink(c)!}>
                      원문 보기
                    </Link>
                  )}
                  {canEdit && (
                    <button type="button" className="text-link" onClick={() => act((t) => api.removeLinkedChapter(t, projectId, selected.foreshadowing_id, c))}>
                      연결 해제
                    </button>
                  )}
                </li>
              ))}
              <li className={`fs-steps__item fs-steps__item--payoff${selected.payoff_chapter ? '' : ' is-open'}`}>
                <span>회수</span> {selected.payoff_chapter ? `${selected.payoff_chapter}장` : '아직 없음'}
              </li>
            </ol>

            {advice && (
              <div className="advice">
                <p className="panel__label">
                  미회수 안내 · 우선순위 <span className={`priority priority--${advice.priority}`}>{PRIORITY[advice.priority]}</span> · {advice.elapsed_chapters}장 경과
                </p>
                <p>{advice.message}</p>
              </div>
            )}
            {(selected.linked_characters.length > 0 || selected.linked_events.length > 0) && (
              <p className="panel__label">
                {[
                  selected.linked_characters.length > 0 && `관련 인물 · ${selected.linked_characters.join(', ')}`,
                  selected.linked_events.length > 0 && `관련 사건 · ${selected.linked_events.join(', ')}`,
                ]
                  .filter(Boolean)
                  .join('   |   ')}
              </p>
            )}

            {panel === 'payoff' && (
              <ChapterForm
                label="회수 장"
                hint={`${selected.setup_chapter}장(설치)보다 뒤의 장을 골라 주세요.`}
                initial={Math.max(selected.setup_chapter + 1, current)}
                busy={busy}
                onCancel={() => (setPanel(null), setError(null))}
                onSubmit={(c) => act((t) => api.setPayoff(t, projectId, selected.foreshadowing_id, c))}
                submitLabel="회수로 표시"
              />
            )}
            {panel === 'link' && (
              <ChapterForm
                label="연결할 장"
                hint="복선이 다시 언급되거나 강화된 장이에요."
                initial={current}
                busy={busy}
                onCancel={() => (setPanel(null), setError(null))}
                onSubmit={(c) => act((t) => api.addLinkedChapter(t, projectId, selected.foreshadowing_id, c))}
                submitLabel="연결 추가"
              />
            )}
            {panel === 'edit' && (
              <EditForm
                fs={selected}
                characters={(characters.data ?? []).map((c) => c.name)}
                busy={busy}
                onCancel={() => (setPanel(null), setError(null))}
                onSubmit={(input) => act((t) => api.updateForeshadowing(t, projectId, selected.foreshadowing_id, input))}
              />
            )}
            {error && (
              <p className="notice notice--error" role="alert">
                {error}
              </p>
            )}

            {canEdit && panel === null && (
              <div className="fs__actions">
                {selected.status === 'orphaned' ? null : selected.status === 'unresolved' ? (
                  <Button onClick={() => setPanel('payoff')}>회수 장면 지정</Button>
                ) : (
                  <Button tone="outline" onClick={() => act((t) => api.cancelPayoff(t, projectId, selected.foreshadowing_id))} disabled={busy}>
                    회수 취소
                  </Button>
                )}
                <Button tone="outline" onClick={() => setPanel('link')}>
                  연결 챕터 추가
                </Button>
                <Button tone="outline" onClick={() => setPanel('edit')}>
                  복선 수정
                </Button>
                {editorLink(selected.setup_chapter) && (
                  <Link className="btn btn--outline" to={editorLink(selected.setup_chapter)!}>
                    관련 장면 열기
                  </Link>
                )}
                <Button tone="error" onClick={() => setConfirmDelete(true)}>
                  삭제
                </Button>
              </div>
            )}
          </section>
        )}
      </div>

      {creating && (
        <CreateDialog
          characters={(characters.data ?? []).map((c) => c.name)}
          defaultChapter={current}
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            const { data, meta } = await withAuth((t) => api.createForeshadowing(t, projectId, input))
            setCreating(false)
            list.reload()
            set({ selected: data.foreshadowing_id })
            if (meta.similar_candidates?.length) setSimilar({ created: data, candidates: meta.similar_candidates })
          }}
        />
      )}

      {similar && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setSimilar(null)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="similar-title" onKeyDown={(e) => e.key === 'Escape' && setSimilar(null)}>
            <h2 id="similar-title" className="panel__title">
              비슷한 복선이 이미 있어요
            </h2>
            <p className="page-desc">새 복선과 내용이 비슷한 복선을 찾았어요. 같은 복선이라면 기존 복선에 장을 연결하는 편이 좋아요.</p>
            <div className="choice-list">
              {similar.candidates.map((c) => (
                <div key={c.foreshadowing_id} className="option">
                  <span className="option__title">
                    {c.code} · {c.title}
                  </span>
                  <span className="option__body">
                    {c.setup_chapter}장 설치 · {c.payoff_chapter ? `${c.payoff_chapter}장 회수` : '미회수'}
                  </span>
                  <Button
                    tone="soft"
                    onClick={() =>
                      act(
                        async (t) => {
                          // 새로 만든 복선을 지우고, 그 설치 장을 기존 복선의 연결 장으로 옮긴다
                          await api.deleteForeshadowing(t, projectId, similar.created.foreshadowing_id)
                          if (similar.created.setup_chapter > c.setup_chapter) await api.addLinkedChapter(t, projectId, c.foreshadowing_id, similar.created.setup_chapter)
                        },
                        () => {
                          setSimilar(null)
                          set({ selected: c.foreshadowing_id })
                        },
                      )
                    }
                  >
                    기존에 연결
                  </Button>
                </div>
              ))}
            </div>
            <div className="dialog__actions">
              <Button onClick={() => setSimilar(null)}>새 복선으로 두기</Button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && selected && (
        <ConfirmDialog
          title="복선을 삭제할까요?"
          body={`${selected.code} ${selected.title}의 설치·연결·회수 기록이 모두 사라지고 되돌릴 수 없어요.`}
          confirmLabel="삭제"
          busy={busy}
          onConfirm={() => act((t) => api.deleteForeshadowing(t, projectId, selected.foreshadowing_id), () => (setConfirmDelete(false), set({ selected: null })))}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

/** 복선마다 한 줄 트랙: 설치(●) · 연결(◆) · 회수(■), 회수 전이면 현재 장까지 열린 트랙 */
/** orphaned: 백엔드가 설치 장 삭제를 받아 표시한다(FTS 명세 12항) */
function StatusBadge({ status, resolved }: { status: Foreshadowing['status']; resolved: string }) {
  if (status === 'unresolved') return <span className="badge badge--waiting">미회수</span>
  if (status === 'orphaned') return <span className="badge badge--filled">설치 장 삭제됨</span>
  return <span className="badge badge--success">{resolved}</span>
}

function TrackView({ rows, max, current, selectedId, onSelect }: { rows: Foreshadowing[]; max: number; current: number; selectedId: string | null; onSelect: (id: string) => void }) {
  const pct = (c: number) => ((c - 1) / Math.max(max - 1, 1)) * 100
  const ticks = Array.from({ length: Math.floor(max / 5) + 1 }, (_, i) => Math.max(1, i * 5))
  return (
    <div className="tracks">
      <div className="tracks__axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: `${pct(t)}%` }}>
            {String(t).padStart(2, '0')}
          </span>
        ))}
        <span className="tracks__now" style={{ left: `${pct(current)}%` }}>
          현재 {current}장
        </span>
      </div>
      <ul className="tracks__rows">
        {rows.map((f) => {
          const end = f.payoff_chapter ?? current
          return (
            <li key={f.foreshadowing_id}>
              <button type="button" className="track" aria-current={selectedId === f.foreshadowing_id || undefined} onClick={() => onSelect(f.foreshadowing_id)}>
                <span className="track__label">
                  {f.code} · {f.title}
                </span>
                <span className="track__lane" aria-label={`설치 ${f.setup_chapter}장${f.linked_chapters.map((c) => `, 연결 ${c}장`).join('')}${f.payoff_chapter ? `, 회수 ${f.payoff_chapter}장` : ', 미회수'}`}>
                  <span className={f.payoff_chapter ? 'track__bar' : 'track__bar is-open'} style={{ left: `${pct(f.setup_chapter)}%`, width: `${pct(end) - pct(f.setup_chapter)}%` }} />
                  <span className="track__mark track__mark--setup" style={{ left: `${pct(f.setup_chapter)}%` }} />
                  {f.linked_chapters.map((c) => (
                    <span key={c} className="track__mark track__mark--linked" style={{ left: `${pct(c)}%` }} />
                  ))}
                  {f.payoff_chapter && <span className="track__mark track__mark--payoff" style={{ left: `${pct(f.payoff_chapter)}%` }} />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="panel__label tracks__legend">● 설치 · ◆ 연결 · ■ 회수 · 점선은 아직 회수하지 않은 열린 트랙</p>
    </div>
  )
}

function ChapterForm({ label, hint, initial, busy, submitLabel, onCancel, onSubmit }: { label: string; hint: string; initial: number; busy: boolean; submitLabel: string; onCancel: () => void; onSubmit: (c: number) => void }) {
  const [value, setValue] = useState(String(initial))
  return (
    <form
      className="record-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(Number(value))
      }}
      noValidate
    >
      <label className="field">
        <span className="field__label">{label}</span>
        <input className="char-search" type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
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

function EditForm({ fs, characters, busy, onCancel, onSubmit }: { fs: Foreshadowing; characters: string[]; busy: boolean; onCancel: () => void; onSubmit: (i: { title: string; description: string; setup_chapter: number; linked_characters: string[] }) => void }) {
  const [title, setTitle] = useState(fs.title)
  const [description, setDescription] = useState(fs.description)
  const [setup, setSetup] = useState(String(fs.setup_chapter))
  const [people, setPeople] = useState<string[]>(fs.linked_characters)
  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({ title: title.trim(), description: description.trim(), setup_chapter: Number(setup), linked_characters: people })
  }
  return (
    <form className="record-form" onSubmit={submit} noValidate>
      <FsFields title={title} setTitle={setTitle} description={description} setDescription={setDescription} setup={setup} setSetup={setSetup} characters={characters} people={people} setPeople={setPeople} />
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

function CreateDialog({ characters, defaultChapter, onCancel, onSubmit }: { characters: string[]; defaultChapter: number; onCancel: () => void; onSubmit: (i: { title: string; description: string; setup_chapter: number; linked_characters: string[] }) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [setup, setSetup] = useState(String(defaultChapter))
  const [people, setPeople] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('복선 제목을 입력해 주세요.')
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), setup_chapter: Number(setup), linked_characters: people })
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="create-fs-title" onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && onCancel()} noValidate>
        <h2 id="create-fs-title" className="panel__title">
          복선 생성
        </h2>
        <FsFields title={title} setTitle={setTitle} description={description} setDescription={setDescription} setup={setup} setSetup={setSetup} characters={characters} people={people} setPeople={setPeople} />
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
    </div>
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

function FsFields({ title, setTitle, description, setDescription, setup, setSetup, characters, people, setPeople }: FsFieldsProps) {
  return (
    <>
      <label className="field">
        <span className="field__label">제목</span>
        <input className="char-search" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="붉은 문의 열쇠" autoFocus />
      </label>
      <label className="field">
        <span className="field__label">설명 · 선택</span>
        <input className="char-search" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="나중에 어떻게 이어질지 적어 두세요" />
      </label>
      <label className="field">
        <span className="field__label">설치 장</span>
        <input className="char-search" type="number" min={1} value={setup} onChange={(e) => setSetup(e.target.value)} />
      </label>
      {characters.length > 0 && (
        <fieldset className="fs__people">
          <legend className="field__label">관련 인물</legend>
          {characters.map((c) => (
            <label key={c} className="chip fs__person">
              <input type="checkbox" checked={people.includes(c)} onChange={(e) => setPeople(e.target.checked ? [...people, c] : people.filter((p) => p !== c))} />
              {c}
            </label>
          ))}
        </fieldset>
      )}
    </>
  )
}
