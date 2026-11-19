import { SourceReviewBadge, SourceReviewNotice } from '../insights/SourceReviewNotice'
import { RichText } from '../../components/RichText'
import { useEffect, useState, type FormEvent } from 'react'
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
import { NarrativeReview } from '../insights/NarrativeReview'
import { foreshadowingManuscript, scopedForeshadowings, eligibleChapters } from '../insights/manuscriptScopeModel'
import { InsightDialog } from '../insights/InsightDialog'
import { chapterPosition, foreshadowStages, pageOf, VIEW_LIMIT } from '../insights/insightModel'
import '../characters/characters.css'
import './foreshadowings.css'
import { Select } from '../../components/Select'
import { ConfirmDialog } from '../../components/ConfirmDialog'

type Panel = 'payoff' | 'link' | 'edit' | null
const statusLabel = (item: Foreshadowing) =>
  item.status === 'orphaned'
    ? '심은 장 없음'
    : item.status === 'resolved'
      ? `${item.payoff_chapter}장에서 회수`
      : '회수 전'
type Confirm = { title: string; body: string; label: string; run: (token: string) => Promise<unknown>; after?: () => void }

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
  const refreshRecords = list.reload
  useEffect(() => {
    const refresh = (event: Event) => { if ((event as CustomEvent).detail === projectId) refreshRecords() }
    window.addEventListener('narrative-adopted', refresh)
    window.addEventListener('focus', refreshRecords)
    return () => {
      window.removeEventListener('narrative-adopted', refresh)
      window.removeEventListener('focus', refreshRecords)
    }
  }, [projectId, refreshRecords])
  const manuscripts = useResource((token) => manuscriptsApi.listManuscripts(token, projectId), [projectId])
  const characters = useResource((token) => charactersApi.listCharacters(token, projectId), [projectId])
  const ready = (manuscripts.data ?? []).filter((item) => item.status === 'ready')
  const requested = (list.data ?? []).find((item) => item.foreshadowing_id === params.get('selected'))
  const latest = ready.find((item) => item.manuscript_id === params.get('manuscript'))
    ?? ready.find((item) => item.manuscript_id === (requested && foreshadowingManuscript(requested))) ?? ready[0]
  useEffect(() => {
    if (!latest || params.get('manuscript') === latest.manuscript_id) return
    const next = new URLSearchParams(params)
    next.set('manuscript', latest.manuscript_id)
    setParams(next, { replace: true })
  }, [latest, params, setParams])
  const demoChapters = useResource(
    latest ? (token) => manuscriptsApi.listChapters(token, projectId, latest.manuscript_id) : null,
    [projectId, latest?.manuscript_id],
  )
  const chapterNumbers = (demoChapters.data ?? []).filter((item) => item.manuscript_id === latest?.manuscript_id).map((item) => item.chapter_no)
  const current = Math.max(1, ...chapterNumbers)
  const unassigned = (list.data ?? []).filter((item) => !foreshadowingManuscript(item))
  const all = params.get('unassigned') === 'true' && IS_REAL ? unassigned
    : scopedForeshadowings(list.data ?? [], latest?.manuscript_id ?? '', IS_REAL)
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
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setPanel(null)
    setCreating(false)
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
  const statusChips: [string, string, number][] = [
    ['unresolved', '회수 전', all.filter((item) => item.status === 'unresolved').length],
    ['resolved', '회수함', all.filter((item) => item.status === 'resolved').length],
    ['all', '전체', all.length],
    ['orphaned', '심은 장 없음', all.filter((item) => item.status === 'orphaned').length],
  ]
  const people = [...new Set(all.flatMap((item) => item.linked_characters))]
  const step = maxChapter <= 12 ? 1 : maxChapter <= 30 ? 5 : 10
  const ticks = Array.from({ length: maxChapter }, (_, i) => i + 1)
  // 마지막 장 번호와 겹치지 않게, 너무 가까운 중간 번호는 생략한다
  const labeled = (n: number) =>
    n === 1 || n === maxChapter || (n % step === 0 && (step === 1 || maxChapter - n > step / 2))
  return (
    <div className="fs insight-page">
      <header className="insight-header">
        <h1 className="page-title">복선</h1>
        <div className="insight-actions">
          <label className="insight-field">
            <span>원고</span>
            <Select aria-label="복선을 기록할 원고" value={latest?.manuscript_id ?? ''}
              disabled={!ready.length}
              onChange={(event) => set({ manuscript: event.target.value, selected: null, page: null, status: null, unassigned: null, foreshadowings_review: null })}>
              {ready.map((item) => <option key={item.manuscript_id} value={item.manuscript_id}>{item.title}</option>)}
            </Select>
          </label>
          {canEdit && (
            <Button
              disabled={!chapterNumbers.length || demoChapters.loading}
              onClick={(event) => {
                event.currentTarget.focus()
                setCreating(true)
              }}
            >
              복선 추가
            </Button>
          )}
        </div>
      </header>
      <InsightNav projectId={projectId} />
      {(manuscripts.error || demoChapters.error) && (
        <p className="notice notice--error" role="alert">
          {manuscripts.error || demoChapters.error}
        </p>
      )}
      {!manuscripts.loading && !latest && (
        <div className="insight-state">
          <h2>원고가 아직 없어요.</h2>
          <p>원고를 올리면 장마다 복선을 심고 회수한 곳을 기록할 수 있어요.</p>
          <Link className="btn btn--primary" to={projectPath(projectId, 'manuscripts')}>
            원고 만들기
          </Link>
        </div>
      )}
      {all.length > 0 && (
        <div className="fs__controls">
          <div className="ai-chips" role="group" aria-label="복선 상태">
            {statusChips
              .filter(([value, , count]) => value !== 'orphaned' || count > 0)
              .map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  className="filter-chip"
                  aria-pressed={status === value}
                  onClick={() => set({ status: value, selected: null, page: null })}
                >
                  {label} <span className="filter-chip__count">{count}</span>
                </button>
              ))}
          </div>
          {people.length > 0 && (
            <label className="insight-field">
              <span>인물</span>
              <Select
                value={character}
                onChange={(event) => set({ character: event.target.value || null, selected: null, page: null })}
              >
                <option value="">모든 인물</option>
                {people.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </Select>
            </label>
          )}
          {IS_REAL && unassigned.length > 0 && (
            <button
              type="button"
              className="text-link fs__unassigned"
              onClick={() => set({ unassigned: params.get('unassigned') === 'true' ? null : 'true', selected: null, status: 'all' })}
            >
              {params.get('unassigned') === 'true' ? '이 원고의 복선으로 돌아가기' : `원고가 정해지지 않은 복선 ${unassigned.length}개`}
            </button>
          )}
        </div>
      )}
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
      {latest && !list.loading && !list.error && !rows.length && (
        <div className="insight-state">
          <h2>{all.length ? '이 조건에 맞는 복선이 없어요.' : '기록한 복선이 아직 없어요.'}</h2>
          {all.length ? (
            <Button tone="outline" onClick={() => set({ status: 'all', character: null, selected: null })}>
              전체 복선 보기
            </Button>
          ) : (
            <>
              <p>복선을 심은 장을 적어 두면, 회수하기 전까지 얼마나 이어지는지 한눈에 볼 수 있어요.</p>
              {canEdit && chapterNumbers.length > 0 && (
                <Button onClick={() => setCreating(true)}>복선 추가</Button>
              )}
            </>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <section className="fs__board" aria-label="복선 타임라인">
          <div className="fs__legend" aria-hidden="true">
            <span><i className="fs__key fs__key--setup" />심은 장</span>
            <span><i className="fs__key fs__key--linked" />다시 나온 장</span>
            <span><i className="fs__key fs__key--payoff" />회수한 장</span>
            <span><i className="fs__key fs__key--open" />아직 회수 전</span>
          </div>
          <div className="fs__axis" aria-hidden="true">
            {ticks.map((n) => (
              <span
                key={n}
                className={labeled(n) ? 'has-label' : undefined}
                style={{ left: `${chapterPosition(n, maxChapter)}%` }}
              >
                {labeled(n) && <em>{n}장</em>}
              </span>
            ))}
          </div>
          <ol className="fs__tracks">
            {page.rows.map((item) => {
              const open = selected?.foreshadowing_id === item.foreshadowing_id
              return (
                <li key={item.foreshadowing_id} className={open ? 'is-open' : undefined}>
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
                        <span className={`fs__status fs__status--${item.status}`}>{statusLabel(item)}</span>
                        <SourceReviewBadge review={item.source_review} />
                      </span>
                      <TrackLane item={item} max={maxChapter} current={current} />
                      <span className="visually-hidden">
                        {item.setup_chapter > 0 ? `${item.setup_chapter}장에 심은 복선` : '심은 장이 없는 복선'}
                      </span>
                    </button>
                  </h2>
                  <div id={`fs-detail-${item.foreshadowing_id}`} hidden={!open}>
                    {open && (
                      <div className="fs__detail">
                        <SourceReviewNotice review={item.source_review} projectId={projectId} canEdit={canEdit}
                          endpoint={`/projects/${projectId}/foreshadowings/${item.foreshadowing_id}/source-confirmation`}
                          onSaved={refreshRecords} />
                        {advice && (
                          <div className="fs__advice" role="note">
                            <strong>
                              {current - (advice.latest_linked_chapter ?? advice.setup_chapter) > 0
                                ? `${(advice.latest_linked_chapter ?? advice.setup_chapter)}장 뒤로 ${current - (advice.latest_linked_chapter ?? advice.setup_chapter)}개 장 동안 다시 나오지 않았어요.`
                                : '아직 회수하지 않았어요.'}
                            </strong>
                            <RichText>{advice.message}</RichText>
                          </div>
                        )}
                        {item.description && <p className="fs__description">{item.description}</p>}
                        <StageList
                          key={item.foreshadowing_id}
                          item={item}
                          sourceLink={(stage) => sourceLink(item, stage)}
                        />
                        {item.linked_characters.length > 0 && (
                          <p className="fs__people-line">
                            <span>함께 엮인 인물</span> {item.linked_characters.join(', ')}
                          </p>
                        )}
                        {error && (
                          <p className="notice notice--error" role="alert">
                            {error}
                          </p>
                        )}
                        {panel === 'payoff' && (
                          <ChapterForm
                            key={`${item.foreshadowing_id}:payoff`}
                            label="회수한 장"
                            hint="복선을 심은 장이나 그 뒤의 장 중에서 골라 주세요."
                            chapters={eligibleChapters(chapterNumbers, item.setup_chapter)}
                            initial={current}
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
                            label="다시 나온 장"
                            hint="이 복선이 다시 등장한 장을 골라 주세요."
                            chapters={eligibleChapters(chapterNumbers, item.setup_chapter, Infinity, [item.setup_chapter, ...item.linked_chapters, ...(item.payoff_chapter === null ? [] : [item.payoff_chapter])])}
                            initial={current}
                            busy={busy}
                            onCancel={() => setPanel(null)}
                            onSubmit={(chapter) =>
                              act((token) => api.addLinkedChapter(token, projectId, item.foreshadowing_id, chapter))
                            }
                            submitLabel="장 추가"
                          />
                        )}
                        {panel === 'edit' && (
                          <EditForm
                            key={item.foreshadowing_id}
                            fs={item}
                            chapters={eligibleChapters(chapterNumbers, 1, item.payoff_chapter ?? Infinity)}
                            characters={(characters.data ?? []).map((person) => person.name)}
                            busy={busy}
                            onCancel={() => setPanel(null)}
                            onSubmit={(input) =>
                              act((token) => api.updateForeshadowing(token, projectId, item.foreshadowing_id, { ...input, manuscript_id: latest?.manuscript_id }), () => set({unassigned: null}))
                            }
                          />
                        )}
                        {canEdit && panel === null && (
                          <>
                            <div className="fs__actions">
                              {item.status === 'unresolved' && (
                                <Button onClick={() => setPanel('payoff')}>회수한 장 지정</Button>
                              )}
                              <Button tone="outline" onClick={() => setPanel('link')}>
                                다시 나온 장 추가
                              </Button>
                              <Button tone="outline" onClick={() => setPanel('edit')}>
                                고치기
                              </Button>
                            </div>
                            <div className="fs__manage">
                              {item.status === 'resolved' && (
                                <button
                                  type="button"
                                  className="text-link text-link--quiet"
                                  disabled={busy}
                                  onClick={() =>
                                    setConfirm({
                                      title: '회수 표시를 취소할까요?',
                                      body: `${item.payoff_chapter}장 회수 기록이 지워지고 '회수 전'으로 돌아가요.`,
                                      label: '회수 취소',
                                      run: (token) => api.cancelPayoff(token, projectId, item.foreshadowing_id),
                                      after: () => set({ status: 'unresolved' }),
                                    })
                                  }
                                >
                                  회수 취소
                                </button>
                              )}
                              {[...new Set(item.linked_chapters)].map((chapter) => (
                                <button
                                  key={chapter}
                                  type="button"
                                  className="text-link text-link--quiet"
                                  disabled={busy}
                                  onClick={() =>
                                    setConfirm({
                                      title: `${chapter}장 연결을 뺄까요?`,
                                      body: `'${item.title}'이(가) ${chapter}장에 다시 나온다는 기록이 지워져요. 원고 본문은 그대로예요.`,
                                      label: '연결 빼기',
                                      run: (token) =>
                                        api.removeLinkedChapter(token, projectId, item.foreshadowing_id, chapter),
                                    })
                                  }
                                >
                                  {chapter}장 연결 빼기
                                </button>
                              ))}
                              <button type="button" className="text-link text-link--quiet text-link--danger" onClick={() => setConfirmDelete(true)}>
                                복선 삭제
                              </button>
                            </div>
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
        </section>
      )}
      {latest && <NarrativeReview key={latest.manuscript_id} projectId={projectId} manuscriptId={latest.manuscript_id} canEdit={canEdit} kind="foreshadowings" />}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.label}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null)
            act(confirm.run, confirm.after)
          }}
        />
      )}
      {creating && (
        <CreateDialog
          chapters={chapterNumbers}
          characters={(characters.data ?? []).map((person) => person.name)}
          defaultChapter={current}
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            const result = await withAuth((token) => api.createForeshadowing(token, projectId, { ...input, manuscript_id: latest?.manuscript_id }))
            list.setData((previous) => [...(previous ?? []), result.data])
            setCreating(false)
            set({ selected: result.data.foreshadowing_id, status: 'unresolved', character: null, page: null, unassigned: null })
            if (result.meta.similar_candidates?.length) setSimilar(result.meta.similar_candidates)
          }}
        />
      )}
      {similar.length > 0 && (
        <InsightDialog title="비슷한 복선이 있어요" onClose={() => setSimilar([])}>
          <p className="page-desc">새 복선은 저장했어요. 기존 복선도 살펴보세요.</p>
          <div className="fs__dialog-list">
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
          <div className="dialog__actions">
            <Button tone="outline" onClick={() => setSimilar([])}>
              닫기
            </Button>
          </div>
        </InsightDialog>
      )}
      {confirmDelete && selected && (
        <InsightDialog title="복선을 삭제할까요?" busy={busy} onClose={() => setConfirmDelete(false)}>
          <p>‘{selected.title}’의 기록이 사라져요. 원고 본문은 남아요.</p>
          {error && <p className="notice notice--error" role="alert">{error}</p>}
          <div className="dialog__actions">
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
}: {
  item: Foreshadowing
  max: number
  current: number
}) {
  if (item.status === 'orphaned' || item.setup_chapter < 1)
    return <span className="fs__missing">심은 장이 지워졌어요. 고치기에서 다시 골라 주세요.</span>
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
      {[...new Set(item.linked_chapters)]
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
  chapters,
  label,
  hint,
  initial,
  busy,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  chapters: number[]
  label: string
  hint: string
  initial: number
  busy: boolean
  submitLabel: string
  onCancel: () => void
  onSubmit: (c: number) => void
}) {
  const [value, setValue] = useState(String(chapters.includes(initial) ? initial : chapters[0] ?? ''))
  return (
    <form
      className="record-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!busy && chapters.includes(Number(value))) onSubmit(Number(value))
      }}
    >
      <label className="field">
        <span className="field__label">{label}</span>
        <Select value={value} onChange={(e) => setValue(e.target.value)} disabled={!chapters.length} autoFocus>
          {chapters.map((no) => <option key={no} value={no}>{no}장</option>)}
        </Select>
        <span className="panel__label">{hint}</span>
        {!chapters.length && <span className="panel__label" role="status">연결할 수 있는 장이 없어요.</span>}
      </label>
      <div className="actions-row">
        <Button tone="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" busy={busy} disabled={!chapters.includes(Number(value))}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function EditForm({
  fs,
  chapters,
  characters,
  busy,
  onCancel,
  onSubmit,
}: {
  fs: Foreshadowing
  chapters: number[]
  characters: string[]
  busy: boolean
  onCancel: () => void
  onSubmit: (i: { title: string; description: string; setup_chapter: number; linked_characters: string[] }) => void
}) {
  const [title, setTitle] = useState(fs.title)
  const [description, setDescription] = useState(fs.description)
  const [setup, setSetup] = useState(String(chapters.includes(fs.setup_chapter) ? fs.setup_chapter : chapters[0] ?? ''))
  const [people, setPeople] = useState<string[]>(fs.linked_characters)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !chapters.includes(Number(setup))) return
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
        chapters={chapters}
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
  chapters,
  characters,
  defaultChapter,
  onCancel,
  onSubmit,
}: {
  chapters: number[]
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
    if (busy || !chapters.includes(Number(setup))) return
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
          chapters={chapters}
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
  chapters: number[]
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
  chapters,
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
        <Select value={setup} onChange={(e) => setSetup(e.target.value)} disabled={!chapters.length}>
          {chapters.map((no) => <option key={no} value={no}>{no}장</option>)}
        </Select>
      </label>
      {characters.length > 0 && (
        <fieldset className="fs__people">
          <legend className="field__label">관련 인물</legend>
          {characters.map((c) => (
            <label key={c} className="filter-chip fs__person">
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
