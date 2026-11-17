import { RichText } from '../../components/RichText'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as manuscriptsApi from '../../api/manuscripts'
import type { Conflict } from '../../api/types'
import * as api from '../../api/world'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { useJob } from '../../lib/useJob'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import '../characters/characters.css'
import '../manuscripts/answer.css'
import './world.css'
import { TextArea } from '../../components/TextArea'
import { InsightNav } from '../insights/InsightNav'
import { Select } from '../../components/Select'
import { RuleReviewSummary } from './RuleReviewSummary'

const SEVERITY = { high: '높음', medium: '보통', low: '낮음' } as const
const STATUS = { pending: '검토 대기', accepted: '검토 완료 · 원고 유지', ignored: '무시함', modified: '직접 수정' } as const
const pad = (n: number) => String(n).padStart(2, '0')

type SkipInfo = { title: string; body: string; action: string; to: string }
const NO_REFERENCE: SkipInfo = {
  title: '비교할 설정이 아직 없어요',
  body: '확정된 인물 설정이나 규칙이 생기면 새 장면과 비교해 드려요.',
  action: '인물 설계하기',
  to: 'characters/new',
}
/** 검사를 건너뛴 이유별 안내 — 무엇이 빠졌는지 정확히 알려 준다 */
const SKIPPED: Record<string, SkipInfo> = {
  NO_CONTENT: {
    title: '검사할 본문이 없어요',
    body: '선택한 장에 본문을 쓴 뒤 다시 검사해 주세요.',
    action: '원고 쓰기',
    to: 'manuscripts',
  },
  ALL_RULES_DISMISSED: {
    title: '이미 무시한 장면이에요',
    body: '같은 장면과 규칙의 검토 결과를 다시 추가하지 않았어요.',
    action: '처리한 설정 확인',
    to: 'conflicts',
  },
  NO_MANUSCRIPT: {
    title: '검사할 원고가 없어요',
    body: '원고를 올리거나 편집기에서 장면을 쓴 뒤 다시 검사해 주세요.',
    action: '원고 쓰기',
    to: 'manuscripts',
  },
  NO_CHARACTERS: {
    title: '확정된 인물이 없어요',
    body: '충돌은 인물의 행동을 규칙과 비교해 찾아요. 인물 초안을 확정한 뒤 다시 검사해 주세요.',
    action: '인물 설계하기',
    to: 'characters/new',
  },
  NO_RULES: {
    title: '확정된 설정 규칙이 없어요',
    body: '저장한 규칙의 의미와 원고를 비교해요. 규칙을 추가하거나 후보를 확정한 뒤 다시 검사해 주세요.',
    action: '설정 규칙 보기',
    to: 'rules',
  },
}
const skipInfo = (reason: string | null) => SKIPPED[reason ?? ''] ?? NO_REFERENCE

// Figma 843:1781 · 05 설정 충돌 검토 (+ 상태 명세 1264:2911 설정 충돌 검토 행)
export function ConflictsPage() {
  const project = useProject()
  return <ConflictReview key={project?.project_id ?? ''} />
}

function ConflictReview() {
  const project = useProject()
  const [params, setParams] = useSearchParams()
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const conflicts = useResource(project ? (t) => api.listConflicts(t, projectId) : null, [projectId])
  const manuscripts = useResource(project ? (t) => manuscriptsApi.listManuscripts(t, projectId) : null, [projectId])
  const ready = (manuscripts.data ?? []).filter((m) => m.status === 'ready')
  const latest = ready.find((m) => m.manuscript_id === params.get('manuscript')) ?? ready[0] ?? null
  const reviewEpoch = useRef(0)
  const [showResolved, setShowResolved] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const detail = useRef<HTMLElement>(null)
  const focusedId = params.get('focus')
  useEffect(() => {
    if (!focusedId) return
    detail.current?.scrollIntoView({ block: 'nearest' })
    detail.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }, [focusedId, showResolved, conflicts.data])

  const check = useJob(
    (t, id) => api.getConflictCheck(t, projectId, id),
    (job) => {
      conflicts.reload()
      if (job.status === 'completed')
        setNotice(
          job.result_ids.length
            ? `새 충돌 후보 ${job.result_ids.length}건을 찾았어요.`
            : job.analysis_kind === 'narrative_review'
              ? '원고 전체 검토를 마쳤어요. 설정·관계·복선과 앞뒤 근거를 확인해 주세요.'
              : job.analysis_kind === 'ai_rule_review'
              ? 'AI 검토를 마쳤어요. 규칙별 지지·위반·판단 불가를 확인해 주세요.'
              : '키워드 검색을 마쳤어요. AI 의미 검토가 없는 이전 검사 결과예요.',
        )
    },
  )

  const reviewManuscriptId = latest?.manuscript_id
  useEffect(() => {
    if (!reviewManuscriptId) return
    let cancelled = false
    const epoch = ++reviewEpoch.current
    check.setJob(null)
    withAuth((token) => api.latestNarrativeReview(token, projectId, reviewManuscriptId))
      .then((job) => { if (!cancelled && epoch === reviewEpoch.current) check.setJob(job) })
      .catch((error) => { if (!cancelled) check.setError(describeError(error)) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, reviewManuscriptId, withAuth])

  if (!project) return <p className="page-desc">작품을 불러오고 있어요</p>
  const canEdit = project.my_role !== 'viewer'
  const all = conflicts.data ?? []
  const pending = all.filter((c) => c.status === 'pending')
  const resolved = all.filter((c) => c.status !== 'pending')
  const list = showResolved ? resolved : pending
  const focus = params.get('focus')
  const selected = list.find((c) => c.conflict_id === focus) ?? null


  function focusConflict(id: string | null) {
    const next = new URLSearchParams(params)
    if (id) next.set('focus', id)
    else next.delete('focus')
    setEditing(null)
    setParams(next, { replace: true })
  }

  async function resolve(c: Conflict, action: 'accepted' | 'ignored' | 'modified', modified_content?: string) {
    setBusy(true)
    setError(null)
    try {
      const updated = await withAuth((t) =>
        api.resolveConflict(t, projectId, c.conflict_id, { action, modified_content, source_hash: c.source_hash }),
      )
      conflicts.setData((prev) => prev?.map((x) => (x.conflict_id === updated.conflict_id ? updated : x)) ?? null)
      // One chapter can contain several findings. Refresh every source revision
      // after an edit so the next unchanged quote can be edited safely as well.
      if (action === 'modified') {
        const refreshed = await withAuth((t) => api.listConflicts(t, projectId))
        conflicts.setData(() => refreshed)
      }
      setEditing(null)
      setNotice(
        action === 'modified'
          ? `${c.evidence[c.evidence.length - 1].chapter}장 문장을 고쳤어요.`
          : action === 'ignored'
            ? '무시한 충돌은 같은 문장에서 다시 감지하지 않아요.'
            : '검토 완료로 표시했어요. 원고는 바뀌지 않았어요.',
      )
      // 다음 미검토 항목으로 넘어간다
      const next = pending.find((x) => x.conflict_id !== c.conflict_id)
      focusConflict(next?.conflict_id ?? null)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  async function startCheck(simulateFailure = false) {
    if (!latest || check.running) return
    reviewEpoch.current += 1
    setNotice(null)
    check.setError(null)
    try {
      check.setJob(await withAuth((t) => api.rescan(t, projectId, simulateFailure, { manuscriptId: latest.manuscript_id, chapterId: '' })))
    } catch (e) {
      check.setError(describeError(e))
    }
  }

  async function retryCheck() {
    if (!check.job) return
    try {
      check.setJob(await withAuth((t) => api.retryConflictCheck(t, projectId, check.job!.job_id)))
    } catch (e) {
      check.setError(describeError(e))
    }
  }

  const job = check.job

  return (
    <div className="world insight-page">
      <header className="world__header">
        <div>
          <h1 className="page-title">설정 검토</h1>
        </div>
        {canEdit && (
          <Button tone="secondary" onClick={() => startCheck()} busy={check.running} disabled={!latest}>
            {check.running ? '검사하는 중…' : '원고 다시 검사'}
          </Button>
        )}
      </header>
      <InsightNav projectId={projectId} />
      {ready.length > 0 && <label className="insight-filter">검사할 원고
        <Select value={latest?.manuscript_id ?? ''} onChange={(event) => {
          const next = new URLSearchParams(params)
          next.set('manuscript', event.target.value)
          setParams(next, { replace: true })
          setNotice(null)
        }}>{ready.map((m) => <option key={m.manuscript_id} value={m.manuscript_id}>{m.title}</option>)}</Select>
      </label>}

      {check.running && (
        <div className="state-block" role="status">
          <span className="answer__spinner" aria-hidden="true" />
          <p className="answer__title">설정 충돌을 검토하고 있어요</p>
          <p className="answer__body">
            {job?.status === 'analyzing'
              ? '원고 전체에서 설정·인물 관계·복선의 변화와 충돌을 대조하고 있어요.'
              : '모든 장의 원문을 준비하고 있어요. 저장된 규칙이 없어도 검사할 수 있어요.'}
          </p>
        </div>
      )}
      <RuleReviewSummary job={job} projectId={projectId} />
      {job?.status === 'failed' && (
        <div className="state-block state-block--error" role="alert">
          <p className="answer__title">AI 검토를 마치지 못했어요</p>
          <p className="answer__body">
            AI 검토나 근거 확인을 완료하지 못했어요. 확인되지 않은 결과는 표시하지 않으며 다시 검사할 수 있어요.
          </p>
          <Button onClick={retryCheck}>AI 검토 다시 시도</Button>
        </div>
      )}
      {job?.status === 'skipped' && (
        <div className="state-block">
          <p className="answer__title">{skipInfo(job.skipped_reason).title}</p>
          <p className="answer__body">{skipInfo(job.skipped_reason).body}</p>
          <Link className="btn btn--primary" to={projectPath(projectId, skipInfo(job.skipped_reason).to)}>
            {skipInfo(job.skipped_reason).action}
          </Link>
        </div>
      )}
      {(notice || check.error) && (
        <p className={check.error ? 'notice notice--error' : 'notice notice--success'} role="status">
          {check.error ?? notice}
        </p>
      )}

      {conflicts.error && (
        <div className="insight-state" role="alert">
          <p>{conflicts.error}</p>
          <Button tone="outline" onClick={conflicts.reload}>
            다시 불러오기
          </Button>
        </div>
      )}
      <div className={`two-col two-col--list${selected ? '' : ' conflict-layout--closed'}`}>
        <section className="panel" aria-labelledby="conflicts-title">
          <div className="world__list-head">
            <h2 id="conflicts-title" className="panel__title">
              {showResolved ? '처리한 후보' : '살펴볼 후보'} {list.length}건
            </h2>
            <label className="visually-hidden" htmlFor="conflict-filter">
              보기
            </label>
            <Select
              id="conflict-filter"
              className="nl-select"
              value={showResolved ? 'resolved' : 'pending'}
              onChange={(e) => setShowResolved(e.target.value === 'resolved')}
            >
              <option value="pending">미검토만</option>
              <option value="resolved">처리됨</option>
            </Select>
          </div>
          {conflicts.loading && !conflicts.data && <p className="panel__label">불러오고 있어요</p>}
          {conflicts.data && list.length === 0 && (
            <div className="state-block">
              <p className="answer__title">{showResolved ? '처리한 충돌이 없어요' : '검토할 충돌이 없어요'}</p>
              <p className="answer__body">
                {showResolved
                  ? '미검토 목록에서 충돌을 처리하면 여기로 옮겨져요.'
                  : '새 장면을 쓴 뒤 원고 다시 검사를 눌러 보세요.'}
              </p>
            </div>
          )}
          <ul className="char-list">
            {list.map((c) => (
              <li key={c.conflict_id}>
                <button
                  type="button"
                  className="char-item"
                  aria-current={selected?.conflict_id === c.conflict_id || undefined}
                  onClick={() => focusConflict(selected?.conflict_id === c.conflict_id ? null : c.conflict_id)}
                >
                  <span className="char-item__name">
                    {pad(c.index)} {c.title}
                  </span>
                  <span className="char-item__meta">
                    <span className={`severity severity--${c.severity}`}>{SEVERITY[c.severity]}</span> ·{' '}
                    {c.evidence.map((e) => (e.chapter ? `${e.chapter}장` : '규칙')).join(' ↔ ')}
                    {c.status !== 'pending' && ` · ${STATUS[c.status]}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!showResolved && resolved.length > 0 && (
            <button type="button" className="projects__more" onClick={() => setShowResolved(true)}>
              처리됨 {resolved.length}건 보기
            </button>
          )}
        </section>

        {selected && (
          <section className="panel" aria-labelledby="conflict-title" ref={detail}>
            <div className="world__list-head">
              <h2 id="conflict-title" className="page-title" tabIndex={-1}>
                {selected.title}
              </h2>
              <span className={selected.status === 'pending' ? 'badge badge--waiting' : 'badge badge--success'}>
                {selected.review_kind === 'keyword' ? '키워드 단서 · AI 미검토' : STATUS[selected.status]}
              </span>
            </div>
            <div className="evidence-pair">
              {selected.evidence.map((e, i) => (
                <div key={i} className="evidence-card">
                  <p className="panel__label">
                    근거 {String.fromCharCode(65 + i)} · {e.chapter ? `${e.chapter}장` : '규칙'}
                    {e.character ? ` · ${e.character}` : ''}
                  </p>
                  <p className="evidence-card__quote">“{e.quote}”</p>
                  {(e.manuscript_id || (i > 0 && (selected.manuscript_id || latest))) && e.chapter > 0 && (
                    <Link
                      className="text-link"
                      to={`${projectPath(projectId, `manuscripts/${e.manuscript_id ?? selected.manuscript_id ?? latest?.manuscript_id}`)}?chapter=${e.chapter}`}
                      state={{ highlight: e.quote }}
                    >
                      {e.chapter}장 원문 보기
                    </Link>
                  )}
                </div>
              ))}
            </div>
            <details className="insight-disclosure">
              <summary>AI 조언</summary>
              <RichText>{selected.advice}</RichText>
            </details>
            {selected.modified_content && <p className="check-note">고친 문장 · “{selected.modified_content}”</p>}

            {editing !== null && (
              <label className="field">
                <span className="field__label">
                  {selected.evidence[selected.evidence.length - 1].chapter}장 문장 고치기
                </span>
                <TextArea
                  className="nl-textarea"
                  style={{ minHeight: 90 }}
                  value={editing}
                  onChange={(e) => setEditing(e.target.value)}
                  autoFocus
                />
                <span className="panel__label">저장하면 원고의 해당 문장이 이 내용으로 바뀌어요.</span>
              </label>
            )}
            {selected.status === 'pending' && (
              <p className="panel__label">
                {selected.edit_unavailable_reason ?? '직접 수정은 원고를 바꾸고, 검토만 완료는 원고를 그대로 둡니다.'}
              </p>
            )}
            {error && (
              <p className="notice notice--error" role="alert">
                {error}
              </p>
            )}
            {canEdit && selected.status === 'pending' && (
              <div className="actions-row">
                {editing === null ? (
                  <>
                    <Button
                      tone="outline"
                      disabled={busy || Boolean(selected.edit_unavailable_reason)}
                      onClick={() => setEditing(selected.evidence[selected.evidence.length - 1].quote)}
                    >
                      직접 수정
                    </Button>
                    <Button tone="outline" onClick={() => resolve(selected, 'ignored')} disabled={busy}>
                      무시
                    </Button>
                    <Button onClick={() => resolve(selected, 'accepted')} busy={busy}>
                      검토만 완료
                    </Button>
                  </>
                ) : (
                  <>
                    <Button tone="outline" onClick={() => setEditing(null)}>
                      취소
                    </Button>
                    <Button
                      onClick={() =>
                        editing.trim()
                          ? resolve(selected, 'modified', editing.trim())
                          : setError('고친 문장을 입력해 주세요.')
                      }
                      busy={busy}
                    >
                      고친 문장 저장
                    </Button>
                  </>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
