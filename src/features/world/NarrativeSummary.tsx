import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ConflictCheck, NarrativeEvidence, NarrativeFinding, NarrativeTrack } from '../../api/types'
import { request } from '../../api/client'
import { Button } from '../../components/Button'
import { RichText } from '../../components/RichText'
import { Select } from '../../components/Select'
import { useProject } from '../app/currentProject'
import { useResource } from '../../lib/useResource'
import { AdoptCandidate } from './AdoptCandidate'
import { adoptionPath, type Adoption } from './adoptionModel'
import { filterTracks, pageItems } from './narrativeBrowseModel'
import './narrativeBrowse.css'

export type NarrativeScope = 'relationship' | 'foreshadowing' | 'setting'

const states: Record<NarrativeTrack['status'], string> = {
  established: '확인된 설정',
  changed: '달라짐',
  paid_off: '회수됨',
  unresolved: '아직 안 풀림',
  reinterpreted: '다시 해석됨',
}
/** 같은 상태도 탭에 맞는 말로 부른다 (관계에서 '확인된 설정'은 어색하다) */
const SCOPE_STATES: Partial<Record<NarrativeScope, Partial<Record<NarrativeTrack['status'], string>>>> = {
  relationship: { established: '그대로 이어짐' },
  foreshadowing: { established: '심어 둠' },
}
const stateLabel = (scope: NarrativeScope, status: NarrativeTrack['status']) =>
  SCOPE_STATES[scope]?.[status] ?? states[status]
const focuses = {
  general: '일반',
  activation: '능력이 쓰이는 조건',
  cost: '대가·약점',
  matchup: '싸움·상성',
  knowledge: '인물이 아는 것',
}
const SCOPE = {
  relationship: { noun: '관계 변화', adopt: '관계 기록으로 등록' },
  foreshadowing: { noun: '복선', adopt: '복선으로 등록' },
  setting: { noun: '설정 확인거리', adopt: '' },
} as const
/** 검색·장 필터는 항목이 이보다 많을 때만 보인다 */
const FILTER_FROM = 8

type Item =
  | { type: 'finding'; finding: NarrativeFinding; key: string }
  | { type: 'track'; track: NarrativeTrack; index: number; key: string }

/**
 * 원고 전체 검토 결과 중 지금 탭에 맞는 후보만 짧은 목록으로 보여 준다.
 * 접힌 상태에서는 한 줄 요약과 버튼만 보이고, 펼치면 후보 카드가 열린다.
 */
export function NarrativeSummary({
  job,
  projectId,
  scope,
  action,
  loading = false,
  error = null,
  onAdopt,
}: {
  job: ConflictCheck | null
  projectId: string
  scope: NarrativeScope
  /** 다시 검사 같은 머리말 오른쪽 버튼 */
  action?: ReactNode
  loading?: boolean
  error?: string | null
  onAdopt?: () => void
}) {
  const project = useProject()
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(() => [...params.keys()].some((k) => k.startsWith('review_')))
  const [candidate, setCandidate] = useState<number | null>(null)
  const result = job?.narrative ?? null
  const saved = useResource(
    job?.status === 'completed' && result
      ? (token) =>
          request<Adoption[]>('GET', `/projects/${projectId}/conflict-checks/${job.job_id}/adoptions`, {
            accessToken: token,
          })
      : null,
    [projectId, job?.job_id, job?.status],
  )
  const { noun, adopt } = SCOPE[scope]

  const filters = {
    query: params.get('review_q') ?? '',
    kind: scope,
    focus: scope === 'setting' ? (params.get('review_focus') ?? '') : '',
    status: params.get('review_status') ?? '',
    chapter: params.get('review_chapter') ?? '',
  }
  const change = (name: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (value) next.set(`review_${name}`, value)
        else next.delete(`review_${name}`)
        if (name !== 'page') next.delete('review_page')
        return next
      },
      { replace: true },
    )
  const reset = () =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        ;[...next.keys()].filter((k) => k.startsWith('review_')).forEach((k) => next.delete(k))
        return next
      },
      { replace: true },
    )

  const scopedTracks = (result?.tracks ?? []).map((track, index) => ({ track, index })).filter(({ track }) => track.kind === scope)
  const scopedFindings = scope === 'setting' ? (result?.findings ?? []) : []
  const total = scopedTracks.length + scopedFindings.length
  const query = filters.query.trim().toLocaleLowerCase()
  const matchesFinding = (f: NarrativeFinding) =>
    (!filters.status || filters.status === f.category) &&
    (!filters.focus) &&
    (!query || [f.title, f.reason, ...f.evidence.map((e) => e.quote)].join(' ').toLocaleLowerCase().includes(query)) &&
    (!filters.chapter || f.evidence.some((e) => String(e.chapter_no) === filters.chapter))
  const trackStatus = filters.status === 'contradiction' || filters.status === 'explanation_gap' ? '__none__' : filters.status
  const items: Item[] = [
    ...scopedFindings.filter(matchesFinding).map((finding, i) => ({ type: 'finding' as const, finding, key: `f${i}` })),
    ...filterTracks(result?.tracks ?? [], { ...filters, status: trackStatus }).map(({ track, index }) => ({
      type: 'track' as const,
      track,
      index,
      key: `t${index}`,
    })),
  ]
  const page = pageItems(items, Number(params.get('review_page') ?? 1))

  // 상태 칩: 이 탭에 실제로 있는 상태만, 개수와 함께
  type Chip = [string, string, number]
  const chips: Chip[] = [
    ['', '전체', total] as Chip,
    ...(scope === 'setting'
      ? ([
          ['contradiction', '어긋남', scopedFindings.filter((f) => f.category === 'contradiction').length],
          ['explanation_gap', '설명이 필요함', scopedFindings.filter((f) => f.category === 'explanation_gap').length],
        ] as Chip[])
      : []),
    ...(Object.keys(states) as NarrativeTrack['status'][]).map(
      (s) => [s, stateLabel(scope, s), scopedTracks.filter(({ track }) => track.status === s).length] as Chip,
    ),
  ].filter(([value, , count]) => value === '' || count > 0)
  const focusList = [...new Set(scopedTracks.map(({ track }) => track.focus ?? 'general'))]
  const chapters = [
    ...new Set(
      [...scopedTracks.flatMap(({ track }) => track.evidence), ...scopedFindings.flatMap((f) => f.evidence)].map(
        (e) => e.chapter_no,
      ),
    ),
  ].sort((a, b) => a - b)
  const filtered = Boolean(filters.status || filters.focus || filters.chapter || filters.query)

  const running = job && ['queued', 'analyzing'].includes(job.status)
  let line: ReactNode
  if (loading) line = '지난 검사 결과를 불러오고 있어요.'
  else if (!job) line = `원고 전체를 읽고 ${noun} 후보를 찾아 드려요.`
  else if (running) line = '원고 전체를 읽고 있어요. 다른 화면으로 옮겨도 검사는 이어져요.'
  else if (job.status === 'failed') line = '검사를 마치지 못했어요. 다시 검사해 주세요.'
  else if (job.status !== 'completed' || !result) line = '이 원고는 아직 검사하지 않았어요.'
  else if (total === 0) line = `원고에서 찾은 ${noun} 후보가 없어요.`
  else
    line = (
      <>
        원고에서 찾은 {noun} 후보 <strong>{total}개</strong>
      </>
    )

  function quote(e: NarrativeEvidence, key: string | number) {
    return (
      <figure className="ai-quote" key={key}>
        <blockquote>{e.quote}</blockquote>
        <figcaption>
          <Link
            className="ai-quote__link"
            to={`/projects/${projectId}/manuscripts/${result!.manuscript_id}?chapter=${e.chapter_no}`}
            state={{ highlight: e.quote }}
          >
            {e.chapter_no}장 원문
          </Link>
        </figcaption>
      </figure>
    )
  }
  function evidence(items: NarrativeEvidence[]) {
    if (!items.length) return null
    const [first, ...rest] = items
    return (
      <>
        {quote(first, 'first')}
        {rest.length > 0 && (
          <details className="ai-more">
            <summary>근거 {rest.length}곳 더 보기</summary>
            {rest.map((e, i) => quote(e, i))}
          </details>
        )}
      </>
    )
  }

  const canShow = job?.status === 'completed' && result && total > 0
  return (
    <section className="ai-strip" aria-label={`AI가 찾은 ${noun} 후보`}>
      <div className="ai-strip__head">
        <p className="ai-strip__line" role={running ? 'status' : undefined}>
          {running && <span className="answer__spinner" aria-hidden="true" />}
          {result?.stale && <span className="badge badge--waiting">이전 원고 기준</span>}
          <span>{line}</span>
        </p>
        <div className="ai-strip__actions">
          {canShow && (
            <Button tone="outline" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? '접기' : '후보 보기'}
            </Button>
          )}
          {action}
        </div>
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {result?.stale && (
        <p className="ai-strip__note">원고가 바뀐 뒤의 결과가 아니에요. 다시 검사하면 지금 원고 기준으로 바뀌어요.</p>
      )}
      {canShow && open && (
        <div className="ai-strip__body">
          <div className="ai-chips" role="group" aria-label="후보 상태">
            {chips.map(([value, label, count]) => (
              <button
                key={value || 'all'}
                type="button"
                className="filter-chip"
                aria-pressed={filters.status === value}
                onClick={() => change('status', value)}
              >
                {label} <span className="filter-chip__count">{count}</span>
              </button>
            ))}
          </div>
          {(total > FILTER_FROM || (scope === 'setting' && focusList.length > 1)) && (
            <div className="narrative-filters">
              {total > FILTER_FROM && (
                <>
                  <label>
                    찾기
                    <input
                      type="search"
                      placeholder="인물 이름이나 문장"
                      value={filters.query}
                      onChange={(e) => change('q', e.target.value)}
                    />
                  </label>
                  <label>
                    나온 장
                    <Select aria-label="나온 장" value={filters.chapter} onChange={(e) => change('chapter', e.target.value)}>
                      <option value="">모든 장</option>
                      {chapters.map((n) => (
                        <option key={n} value={n}>
                          {n}장
                        </option>
                      ))}
                    </Select>
                  </label>
                </>
              )}
              {scope === 'setting' && focusList.length > 1 && (
                <label>
                  살펴볼 점
                  <Select aria-label="살펴볼 점" value={filters.focus} onChange={(e) => change('focus', e.target.value)}>
                    <option value="">모두</option>
                    {focusList.map((f) => (
                      <option key={f} value={f}>
                        {focuses[f]}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
            </div>
          )}
          {filtered && (
            <button className="text-link narrative-reset" type="button" onClick={reset}>
              조건 지우기
            </button>
          )}
          {page.items.length === 0 && <p className="ai-strip__note">조건에 맞는 후보가 없어요.</p>}
          <ul className="ai-cards">
            {page.items.map((item) => {
              if (item.type === 'finding') {
                const f = item.finding
                return (
                  <li key={item.key}>
                    <article className="ai-card">
                      <header className="ai-card__head">
                        <span className={f.category === 'contradiction' ? 'badge badge--error' : 'badge badge--waiting'}>
                          {f.category === 'contradiction' ? '어긋남' : '설명이 필요함'}
                        </span>
                        <h3>{f.title}</h3>
                      </header>
                      <RichText>{f.reason}</RichText>
                      {/* 어긋난 두 곳은 나란히 비교해야 하므로 접지 않는다 */}
                      <div className="ai-pair">{f.evidence.map((e, i) => quote(e, i))}</div>
                    </article>
                  </li>
                )
              }
              const t = item.track
              const adopted = !saved.loading && saved.data?.find((a) => a.index === item.index)
              return (
                <li key={item.key}>
                  <article className="ai-card">
                    <header className="ai-card__head">
                      <span className="badge badge--filled">{stateLabel(scope, t.status)}</span>
                      <h3>{t.title}</h3>
                      {scope === 'setting' && t.focus && t.focus !== 'general' && (
                        <span className="ai-card__meta">{focuses[t.focus]}</span>
                      )}
                    </header>
                    <RichText>{t.explanation}</RichText>
                    {evidence(t.evidence)}
                    {adopted ? (
                      <Link className="ai-card__done" to={adoptionPath(projectId, result.manuscript_id, adopted)}>
                        등록함 · 기록 보기
                      </Link>
                    ) : (
                      adopt &&
                      project &&
                      project.my_role !== 'viewer' && (
                        <div className="ai-card__actions">
                          <Button
                            tone="outline"
                            disabled={result.stale || saved.loading || !!saved.error}
                            onClick={() => setCandidate(item.index)}
                          >
                            {adopt}
                          </Button>
                        </div>
                      )
                    )}
                  </article>
                </li>
              )
            })}
          </ul>
          {page.pages > 1 && (
            <nav className="insight-pagination" aria-label="후보 페이지">
              <Button tone="outline" disabled={page.page <= 1} onClick={() => change('page', String(page.page - 1))}>
                이전
              </Button>
              <span aria-live="polite">
                {page.page} / {page.pages}
              </span>
              <Button
                tone="outline"
                disabled={page.page >= page.pages}
                onClick={() => change('page', String(page.page + 1))}
              >
                다음
              </Button>
            </nav>
          )}
          {adopt && saved.error && (
            <p className="notice notice--error" role="alert">
              등록한 후보를 불러오지 못했어요.{' '}
              <button type="button" className="text-link" onClick={saved.reload}>
                다시 시도
              </button>
            </p>
          )}
          <p className="ai-strip__note">
            AI가 원고를 읽고 짐작한 결과예요. 맞는 것만 골라 기록해 주세요. 후보가 없다고 모든 설정이 맞는 것은
            아니에요.
          </p>
        </div>
      )}
      {candidate !== null && result && (
        <AdoptCandidate
          projectId={projectId}
          manuscriptId={result.manuscript_id}
          jobId={job!.job_id}
          track={result.tracks[candidate]}
          index={candidate}
          onClose={() => setCandidate(null)}
          onSaved={(value) => {
            saved.setData((previous) => [...(previous ?? []), value])
            setCandidate(null)
            onAdopt?.()
            window.dispatchEvent(new CustomEvent('narrative-adopted', { detail: projectId }))
          }}
        />
      )}
    </section>
  )
}
