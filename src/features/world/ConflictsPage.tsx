import { useState } from 'react'
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

const SEVERITY = { high: '높음', medium: '보통', low: '낮음' } as const
const STATUS = { pending: '검토 대기', accepted: '제안 수용', ignored: '무시함', modified: '직접 수정' } as const
const pad = (n: number) => String(n).padStart(2, '0')

// Figma 843:1781 · 05 설정 충돌 검토 (+ 상태 명세 1264:2911 설정 충돌 검토 행)
export function ConflictsPage() {
  const project = useProject()
  const [params, setParams] = useSearchParams()
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const conflicts = useResource(project ? (t) => api.listConflicts(t, projectId) : null, [projectId])
  const manuscripts = useResource(project ? (t) => manuscriptsApi.listManuscripts(t, projectId) : null, [projectId])
  const [showResolved, setShowResolved] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const check = useJob(
    (t, id) => api.getConflictCheck(t, projectId, id),
    (job) => {
      conflicts.reload()
      if (job.status === 'completed') setNotice(job.result_ids.length ? `새 충돌 후보 ${job.result_ids.length}건을 찾았어요.` : '새로 찾은 충돌이 없어요.')
    },
  )

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>
  const canEdit = project.my_role !== 'viewer'
  const all = conflicts.data ?? []
  const pending = all.filter((c) => c.status === 'pending')
  const resolved = all.filter((c) => c.status !== 'pending')
  const list = showResolved ? resolved : pending
  const focus = params.get('focus')
  const selected = all.find((c) => c.conflict_id === focus) ?? list[0] ?? null
  const latest = (manuscripts.data ?? []).filter((m) => m.status === 'ready')[0] ?? null

  async function resolve(c: Conflict, action: 'accepted' | 'ignored' | 'modified', modified_content?: string) {
    setBusy(true)
    setError(null)
    try {
      const updated = await withAuth((t) => api.resolveConflict(t, projectId, c.conflict_id, { action, modified_content }))
      conflicts.setData((prev) => prev?.map((x) => (x.conflict_id === updated.conflict_id ? updated : x)) ?? null)
      setEditing(null)
      setNotice(
        action === 'modified'
          ? `${c.evidence[c.evidence.length - 1].chapter}장 문장을 고쳤어요.`
          : action === 'ignored'
            ? '무시한 충돌은 같은 문장에서 다시 감지하지 않아요.'
            : '제안을 수용했어요.',
      )
      // 다음 미검토 항목으로 넘어간다
      const next = pending.find((x) => x.conflict_id !== c.conflict_id)
      setParams(next ? { focus: next.conflict_id } : {}, { replace: true })
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  async function startCheck(simulateFailure = false) {
    setNotice(null)
    check.setError(null)
    try {
      check.setJob(await withAuth((t) => api.rescan(t, projectId, simulateFailure)))
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
    <div className="world">
      <header className="world__header">
        <div>
          <p className="page-crumb">검토 / 미해결 {pending.length}건</p>
          <h1 className="page-title">설정 충돌 검토</h1>
          <p className="page-desc">충돌 후보의 두 근거와 변경 결과를 비교한 뒤 처리하세요.</p>
        </div>
        {canEdit && (
          <Button tone="secondary" onClick={() => startCheck()} busy={check.running}>
            {check.running ? '검사하는 중…' : '원고 다시 검사'}
          </Button>
        )}
      </header>

      {check.running && (
        <div className="state-block" role="status">
          <span className="answer__spinner" aria-hidden="true" />
          <p className="answer__title">설정 충돌을 검토하고 있어요</p>
          <p className="answer__body">
            {job?.status === 'analyzing' ? '기본 규칙 검사는 끝났고, AI가 문맥을 한 번 더 살펴보고 있어요.' : '확정된 규칙과 인물 설정을 원고와 비교하고 있어요.'}
          </p>
        </div>
      )}
      {job?.status === 'failed' && (
        <div className="state-block state-block--error" role="alert">
          <p className="answer__title">AI 검토를 마치지 못했어요</p>
          <p className="answer__body">규칙 검사 결과는 먼저 보여 드려요. AI 조언만 다시 받을 수 있어요.</p>
          <Button onClick={retryCheck}>AI 검토 다시 시도</Button>
        </div>
      )}
      {job?.status === 'skipped' && (
        <div className="state-block">
          <p className="answer__title">비교할 설정이 아직 없어요</p>
          <p className="answer__body">확정된 인물 설정이나 규칙이 생기면 새 장면과 비교해 드려요.</p>
          <Link className="btn btn--primary" to={projectPath(projectId, 'characters/new')}>
            인물 설계하기
          </Link>
        </div>
      )}
      {(notice || check.error) && (
        <p className={check.error ? 'notice notice--error' : 'notice notice--success'} role="status">
          {check.error ?? notice}
        </p>
      )}

      <div className="two-col two-col--list">
        <section className="panel" aria-labelledby="conflicts-title">
          <div className="world__list-head">
            <h2 id="conflicts-title" className="panel__title">
              충돌 후보 {pending.length}건
            </h2>
            <label className="visually-hidden" htmlFor="conflict-filter">
              보기
            </label>
            <select id="conflict-filter" className="nl-select" value={showResolved ? 'resolved' : 'pending'} onChange={(e) => setShowResolved(e.target.value === 'resolved')}>
              <option value="pending">미검토만</option>
              <option value="resolved">처리됨</option>
            </select>
          </div>
          {conflicts.loading && !conflicts.data && <p className="panel__label">불러오고 있어요</p>}
          {conflicts.data && list.length === 0 && (
            <div className="state-block">
              <p className="answer__title">{showResolved ? '처리한 충돌이 없어요' : '검토할 충돌이 없어요'}</p>
              <p className="answer__body">{showResolved ? '미검토 목록에서 충돌을 처리하면 여기로 옮겨져요.' : '새 장면을 쓴 뒤 원고 다시 검사를 눌러 보세요.'}</p>
            </div>
          )}
          <ul className="char-list">
            {list.map((c) => (
              <li key={c.conflict_id}>
                <button
                  type="button"
                  className="char-item"
                  aria-current={selected?.conflict_id === c.conflict_id || undefined}
                  onClick={() => (setEditing(null), setParams({ focus: c.conflict_id }, { replace: true }))}
                >
                  <span className="char-item__name">
                    {pad(c.index)} {c.title}
                  </span>
                  <span className="char-item__meta">
                    <span className={`severity severity--${c.severity}`}>{SEVERITY[c.severity]}</span> · {c.evidence.map((e) => (e.chapter ? `${e.chapter}장` : '규칙')).join(' ↔ ')}
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
          <section className="panel" aria-labelledby="conflict-title">
            <div className="world__list-head">
              <h2 id="conflict-title" className="page-title">
                {selected.title}
              </h2>
              <span className={selected.status === 'pending' ? 'badge badge--waiting' : 'badge badge--success'}>{STATUS[selected.status]}</span>
            </div>
            <div className="evidence-pair">
              {selected.evidence.map((e, i) => (
                <div key={i} className="evidence-card">
                  <p className="panel__label">
                    근거 {String.fromCharCode(65 + i)} · {e.chapter ? `${e.chapter}장` : '규칙'}
                    {e.character ? ` · ${e.character}` : ''}
                  </p>
                  <p className="evidence-card__quote">“{e.quote}”</p>
                  {latest && e.chapter > 0 && (
                    <Link className="text-link" to={`${projectPath(projectId, `manuscripts/${latest.manuscript_id}`)}?chapter=${e.chapter}`} state={{ highlight: e.quote }}>
                      {e.chapter}장 원문 보기
                    </Link>
                  )}
                </div>
              ))}
            </div>
            <div className="advice">
              <p className="panel__label">AI 조언</p>
              <p>{selected.advice}</p>
            </div>
            {selected.modified_content && <p className="check-note">고친 문장 · “{selected.modified_content}”</p>}

            {editing !== null && (
              <label className="field">
                <span className="field__label">{selected.evidence[selected.evidence.length - 1].chapter}장 문장 고치기</span>
                <TextArea className="nl-textarea" style={{ minHeight: 90 }} value={editing} onChange={(e) => setEditing(e.target.value)} autoFocus />
                <span className="panel__label">저장하면 원고의 해당 문장이 이 내용으로 바뀌어요.</span>
              </label>
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
                    <Button tone="outline" onClick={() => setEditing(selected.evidence[selected.evidence.length - 1].quote)}>
                      직접 수정
                    </Button>
                    <Button tone="outline" onClick={() => resolve(selected, 'ignored')} disabled={busy}>
                      무시
                    </Button>
                    <Button onClick={() => resolve(selected, 'accepted')} busy={busy}>
                      제안 수용
                    </Button>
                  </>
                ) : (
                  <>
                    <Button tone="outline" onClick={() => setEditing(null)}>
                      취소
                    </Button>
                    <Button onClick={() => (editing.trim() ? resolve(selected, 'modified', editing.trim()) : setError('고친 문장을 입력해 주세요.'))} busy={busy}>
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
