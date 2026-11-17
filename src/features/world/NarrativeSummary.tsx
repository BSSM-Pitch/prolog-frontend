import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ConflictCheck, NarrativeEvidence } from '../../api/types'
import { request } from '../../api/client'
import { RichText } from '../../components/RichText'
import { useProject } from '../app/currentProject'
import { useResource } from '../../lib/useResource'
import { AdoptCandidate } from './AdoptCandidate'
import { adoptionPath, type Adoption } from './adoptionModel'
import { filterTracks, pageItems } from './narrativeBrowseModel'
import './narrativeBrowse.css'
const states = {
  established: '설정 확인',
  changed: '변화 추적',
  paid_off: '회수 확인',
  unresolved: '미해결',
  reinterpreted: '오해·해석 정정',
}
const kinds = { setting: '설정', relationship: '관계', foreshadowing: '복선' }
const focuses = {
  general: '일반',
  activation: '능력 조건',
  cost: '대가·약점',
  matchup: '전투·상성',
  knowledge: '인물 지식',
}
export function NarrativeSummary({
  job,
  projectId,
  kind = '',
  onAdopt,
}: {
  job: ConflictCheck
  projectId: string
  kind?: string
  onAdopt?: () => void
}) {
  const project = useProject()
  const [params, setParams] = useSearchParams()
  const [candidate, setCandidate] = useState<number | null>(null)
  const saved = useResource(
    job.status === 'completed' && job.narrative
      ? (token) =>
          request<Adoption[]>('GET', `/projects/${projectId}/conflict-checks/${job.job_id}/adoptions`, {
            accessToken: token,
          })
      : null,
    [projectId, job.job_id, job.status],
  )
  const result = job.narrative
  if (!result) return null
  const filters = {
    query: params.get('review_q') ?? '',
    kind: params.get('review_kind') ?? kind,
    focus: params.get('review_focus') ?? '',
    status: params.get('review_status') ?? '',
    chapter: params.get('review_chapter') ?? '',
  }
  const change = (name: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set(`review_${name}`, value)
        if (name !== 'page' && name !== 'issues') {
          next.delete('review_page')
          next.delete('review_issues')
        }
        return next
      },
      { replace: true },
    )
  const rows = filterTracks(result.tracks, filters)
  const tracks = pageItems(rows, Number(params.get('review_page') ?? 1))
  const query = filters.query.trim().toLocaleLowerCase()
  const findings = result.findings.filter(
    (f) =>
      (!query ||
        [f.title, f.reason, ...f.evidence.map((e) => e.quote)]
          .join(' ')
          .toLocaleLowerCase()
          .includes(query)) &&
      (!filters.chapter || f.evidence.some((e) => String(e.chapter_no) === filters.chapter)),
  )
  const issues = pageItems(findings, Number(params.get('review_issues') ?? 1))
  const chapters = [
    ...new Set(
      [...result.tracks.flatMap((t) => t.evidence), ...result.findings.flatMap((f) => f.evidence)].map(
        (e) => e.chapter_no,
      ),
    ),
  ].sort((a, b) => a - b)
  function evidence(items: NarrativeEvidence[]) {
    return (
      <details className="narrative-sources">
        <summary>원문 근거 {items.length}곳</summary>
        <ul>
          {items.map((e, i) => (
            <li key={`${e.chapter_id}-${i}`}>
              <Link
                to={`/projects/${projectId}/manuscripts/${result!.manuscript_id}?chapter=${e.chapter_no}`}
                state={{ highlight: e.quote }}
              >
                {e.chapter_no}장 원문 보기
              </Link>
              <blockquote>{e.quote}</blockquote>
            </li>
          ))}
        </ul>
      </details>
    )
  }
  function pages(name: string, page: number, total: number) {
    return (
      total > 1 && (
        <nav
          className="writer-actions"
          aria-label={name === 'page' ? '추적 항목 페이지' : '문제 후보 페이지'}
        >
          <button type="button" disabled={page <= 1} onClick={() => change(name, String(page - 1))}>
            이전
          </button>
          <span aria-live="polite">
            {page} / {total}
          </span>
          <button type="button" disabled={page >= total} onClick={() => change(name, String(page + 1))}>
            다음
          </button>
        </nav>
      )
    )
  }
  return (
    <section className="evidence-box narrative-browse" aria-label="원고 전체 설정·복선 검토">
      <h2 className="panel__title">
        {job.status === 'completed'
          ? '원고 전체 검토 결과'
          : job.status === 'failed'
            ? '원고 전체 검토를 마치지 못했어요'
            : '원고 전체를 대조하고 있어요'}
      </h2>
      <p>
        {result.chapter_count}장 · {result.char_count.toLocaleString()}자 · 설정·관계·복선
      </p>
      {result.stale && (
        <p role="status">현재 원고나 검사 기준과 맞지 않는 이전 결과예요. 현재 원고로 다시 검사해 주세요.</p>
      )}
      {['queued', 'analyzing'].includes(job.status) && (
        <p role="status">
          앞부분의 설정부터 마지막 장까지 비교하고 원문 근거를 다시 확인해요. 다른 화면으로 이동해도 검사는
          계속됩니다.
        </p>
      )}
      {job.status === 'completed' && (
        <>
          <RichText>{result.summary}</RichText>
          <p>
            충돌 후보 {result.findings.filter((f) => f.category === 'contradiction').length}건 · 설명 확인{' '}
            {result.findings.filter((f) => f.category === 'explanation_gap').length}건 · 추적 항목{' '}
            {result.tracks.length}건
          </p>
          {result.more_items && (
            <p role="status">
              주요 항목부터 표시했어요. 분석 결과의 표시 한도로 일부 항목이 포함되지 않았습니다.
            </p>
          )}
          <div className="narrative-filters">
            <label>
              검토 내용 검색
              <input
                type="search"
                placeholder="인물 이름, 설정, 근거 문장"
                value={filters.query}
                onChange={(e) => change('q', e.target.value)}
              />
            </label>
            <label>
              근거가 있는 장
              <select value={filters.chapter} onChange={(e) => change('chapter', e.target.value)}>
                <option value="">모든 장</option>
                {chapters.map((n) => (
                  <option key={n} value={n}>
                    {n}장
                  </option>
                ))}
              </select>
            </label>
          </div>
          <details>
            <summary>
              확인할 문제와 앞뒤 근거 {findings.length} / {result.findings.length}건
            </summary>
            {issues.items.map((f, i) => (
              <article className="evidence-box" key={`${issues.page}-${i}`}>
                <h3>
                  {f.category === 'contradiction' ? '충돌 후보' : '설명 확인'} · {f.title}
                </h3>
                <RichText>{f.reason}</RichText>
                {evidence(f.evidence)}
              </article>
            ))}
            {!findings.length && <p>검색 조건에 맞는 문제 후보가 없어요.</p>}
            {pages('issues', issues.page, issues.pages)}
          </details>
          <details open>
            <summary>
              자동으로 추적한 설정·관계·복선 {rows.length} / {result.tracks.length}건
            </summary>
            <div className="narrative-filters">
              {(
                [
                  ['kind', '종류', kinds],
                  ['focus', '검토 관점', focuses],
                  ['status', '추적 상태', states],
                ] as const
              ).map(([key, label, options]) => (
                <label key={key}>
                  {label}
                  <select value={filters[key]} onChange={(e) => change(key, e.target.value)}>
                    <option value="">전체</option>
                    {Object.entries(options).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              className="text-link"
              type="button"
              onClick={() =>
                setParams(
                  (previous) => {
                    const next = new URLSearchParams(previous)
                    ;[...next.keys()].filter((k) => k.startsWith('review_')).forEach((k) => next.delete(k))
                    return next
                  },
                  { replace: true },
                )
              }
            >
              검색·필터 초기화
            </button>
            {tracks.items.map(({ track: t, index }) => {
              const adopted = !saved.loading && saved.data?.find((a) => a.index === index)
              return (
                <article className="evidence-box" key={index}>
                  <h3>
                    {t.focus && t.focus !== 'general' ? focuses[t.focus] : kinds[t.kind]} · {t.title} ·{' '}
                    {states[t.status]}
                  </h3>
                  <RichText>{t.explanation}</RichText>
                  {evidence(t.evidence)}
                  {adopted ? (
                    <Link className="text-link" to={adoptionPath(projectId, result.manuscript_id, adopted)}>
                      등록됨 · 관리 목록 보기
                    </Link>
                  ) : (
                    project?.my_role !== 'viewer' &&
                    project &&
                    t.kind !== 'setting' && (
                      <button
                        className="text-link"
                        type="button"
                        disabled={result.stale || saved.loading || !!saved.error}
                        onClick={() => setCandidate(index)}
                      >
                        {t.kind === 'relationship' ? '관계 기록으로 등록' : '복선으로 등록'}
                      </button>
                    )
                  )}
                </article>
              )
            })}
            {!rows.length && <p>검색 조건에 맞는 추적 항목이 없어요. 필터를 바꿔 보세요.</p>}
            {pages('page', tracks.page, tracks.pages)}
          </details>
          {saved.error && (
            <p role="alert">
              등록 상태를 불러오지 못했어요. <button onClick={saved.reload}>다시 시도</button>
            </p>
          )}
          <p className="panel__label">
            원고에서 추론한 검토 결과예요. 미해결 복선은 오류와 구분하며, 발견된 충돌이 없다고 모든 설정이
            검증된 것은 아니에요.
          </p>
          {candidate !== null && (
            <AdoptCandidate
              projectId={projectId}
              manuscriptId={result.manuscript_id}
              jobId={job.job_id}
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
        </>
      )}
    </section>
  )
}
