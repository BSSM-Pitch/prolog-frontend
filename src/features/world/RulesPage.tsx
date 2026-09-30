import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as manuscriptsApi from '../../api/manuscripts'
import type { WorldRule } from '../../api/types'
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

type Draft = { title: string; description: string; keywords: string }
const toKeywords = (s: string) => s.split(/[,\n]/).map((k) => k.trim()).filter(Boolean)

// Figma 843:1659 · 21 설정 규칙
export function RulesPage() {
  const project = useProject()
  const [params, setParams] = useSearchParams()
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const rules = useResource(project ? (t) => api.listRules(t, projectId) : null, [projectId])
  const manuscripts = useResource(project ? (t) => manuscriptsApi.listManuscripts(t, projectId) : null, [projectId])
  const [editing, setEditing] = useState<Draft | null>(null)
  const [adding, setAdding] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const latest = (manuscripts.data ?? []).filter((m) => m.status === 'ready')[0] ?? null

  const extraction = useJob(latest ? (t, id) => api.getRuleExtraction(t, projectId, latest.manuscript_id, id) : null, (job) => {
    rules.reload()
    setNotice(job.status === 'completed' ? (job.result_ids.length ? `규칙 후보 ${job.result_ids.length}개를 새로 찾았어요.` : '원고에서 새로 찾은 규칙 후보가 없어요.') : null)
  })

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>
  const canEdit = project.my_role !== 'viewer'
  const visible = (rules.data ?? []).filter((r) => r.status !== 'ignored')
  const pending = visible.filter((r) => r.status === 'pending')
  const confirmed = visible.filter((r) => r.status === 'confirmed')
  const ordered = [...pending, ...confirmed]
  const selected = ordered.find((r) => r.rule_id === params.get('selected')) ?? ordered[0] ?? null
  const select = (id: string) => {
    setEditing(null)
    setAdding(null)
    setParams({ selected: id }, { replace: true })
  }

  async function act(fn: (token: string) => Promise<WorldRule | null>, after?: (r: WorldRule | null) => void) {
    setBusy(true)
    setError(null)
    try {
      const r = await withAuth(fn)
      rules.reload()
      after?.(r)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  async function startExtraction() {
    if (!latest) return
    setNotice(null)
    extraction.setError(null)
    try {
      extraction.setJob(await withAuth((t) => api.extractRules(t, projectId, latest.manuscript_id)))
    } catch (e) {
      extraction.setError(describeError(e))
    }
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!selected || !editing) return
    if (!editing.description.trim()) return setError('규칙 내용을 입력해 주세요.')
    act(
      (t) => api.updateRule(t, projectId, selected.rule_id, { title: editing.title.trim(), description: editing.description.trim(), violation_keywords: toKeywords(editing.keywords) }),
      () => setEditing(null),
    )
  }

  function saveAdd(e: FormEvent) {
    e.preventDefault()
    if (!adding) return
    if (!adding.description.trim()) return setError('규칙 내용을 입력해 주세요.')
    act(
      (t) => api.addRule(t, projectId, { title: adding.title.trim() || undefined, description: adding.description.trim(), violation_keywords: toKeywords(adding.keywords) }),
      (r) => {
        setAdding(null)
        if (r) setParams({ selected: r.rule_id }, { replace: true })
      },
    )
  }

  const running = extraction.running

  return (
    <div className="world">
      <header>
        <p className="page-crumb">
          원고 기반 규칙 / 확정 {confirmed.length} · 검토 대기 {pending.length}
        </p>
        <h1 className="page-title">설정 규칙</h1>
        <p className="page-desc">원고에서 추출한 세계관 규칙 후보를 근거와 함께 확인하세요.</p>
      </header>
      {notice && (
        <p className="notice notice--success" role="status">
          {notice}
        </p>
      )}

      <div className="two-col two-col--list">
        <section className="panel" aria-labelledby="rules-title">
          <h2 id="rules-title" className="panel__title">
            규칙 {visible.length}개
          </h2>
          <div className="chips">
            <span className="badge badge--filled">확정 {confirmed.length}</span>
            <span className="badge badge--waiting">검토 대기 {pending.length}</span>
          </div>

          {running && (
            <div className="state-block" role="status">
              <span className="answer__spinner" aria-hidden="true" />
              <p className="answer__title">설정 규칙을 찾고 있어요</p>
              <p className="answer__body">세계관 규칙으로 볼 만한 문장을 원고에서 모으는 중이에요.</p>
            </div>
          )}
          {extraction.job?.status === 'failed' && (
            <div className="state-block state-block--error" role="alert">
              <p className="answer__title">규칙을 추출하지 못했어요</p>
              <p className="answer__body">이미 확정한 규칙은 그대로 남아 있어요.</p>
            </div>
          )}
          {rules.data && visible.length === 0 && !running && (
            <div className="state-block">
              <p className="answer__title">찾은 규칙이 없어요</p>
              <p className="answer__body">원고에서 규칙을 추출하거나 필요한 규칙을 직접 추가해 보세요.</p>
            </div>
          )}

          <ul className="char-list">
            {ordered.map((r) => (
              <li key={r.rule_id}>
                <button type="button" className="char-item" aria-current={selected?.rule_id === r.rule_id || undefined} onClick={() => select(r.rule_id)}>
                  <span className="char-item__name">
                    {r.status === 'pending' && <span className="rule-tag">후보</span>}
                    {r.code} · {r.title}
                  </span>
                  <span className="char-item__meta">
                    {r.description}
                    {' / '}
                    {r.status === 'pending' ? `${r.origin === 'ai_extracted' ? 'AI 추출 · ' : ''}${r.source_chapter ? `${r.source_chapter}장 근거` : r.origin === 'ai_extracted' ? '원고 근거' : '직접 추가'}` : '확정'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {canEdit && (
            <div className="actions-row">
              <Button tone="outline" onClick={() => (setAdding({ title: '', description: '', keywords: '' }), setEditing(null))}>
                + 규칙 직접 추가
              </Button>
              <Button tone="secondary" onClick={startExtraction} busy={running} disabled={!latest}>
                {running ? '추출하는 중…' : '원고에서 다시 추출'}
              </Button>
            </div>
          )}
          {extraction.error && <p className="notice notice--error">{extraction.error}</p>}
          {!latest && manuscripts.data && <p className="panel__label">규칙을 추출하려면 먼저 원고를 올려 주세요.</p>}
        </section>

        {adding ? (
          <form className="panel" onSubmit={saveAdd} noValidate>
            <h2 className="panel__title">규칙 직접 추가</h2>
            <RuleFields draft={adding} onChange={setAdding} />
            {error && <p className="notice notice--error">{error}</p>}
            <div className="actions-row">
              <Button tone="outline" onClick={() => setAdding(null)}>
                취소
              </Button>
              <Button type="submit" busy={busy}>
                규칙 추가
              </Button>
            </div>
          </form>
        ) : selected ? (
          <section className="panel" aria-labelledby="rule-detail-title">
            <p className="panel__label">
              {selected.status === 'pending' ? `${selected.origin === 'ai_extracted' ? 'AI 추출 후보' : '후보'} / ${selected.code}` : `확정 규칙 / ${selected.code}`}
            </p>
            <div className="chips">
              {selected.origin === 'ai_extracted' ? <span className="badge badge--done">AI 추출</span> : <span className="badge badge--outline">직접 추가</span>}
              {selected.status === 'pending' ? <span className="badge badge--waiting">검토 대기</span> : <span className="badge badge--success">확정</span>}
            </div>

            {editing ? (
              <form className="nl-design" style={{ gap: 12 }} onSubmit={saveEdit} noValidate>
                <RuleFields draft={editing} onChange={setEditing} />
                {error && <p className="notice notice--error">{error}</p>}
                <div className="actions-row">
                  <Button tone="outline" onClick={() => setEditing(null)}>
                    취소
                  </Button>
                  <Button type="submit" busy={busy}>
                    저장
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <h2 id="rule-detail-title" className="page-title">
                  {selected.description}
                </h2>
                <div>
                  <p className="panel__label">위반 판정 키워드</p>
                  {selected.violation_keywords.length ? (
                    <div className="chips">
                      {selected.violation_keywords.map((k) => (
                        <span key={k} className="chip">
                          {k}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="panel__label">아직 없어요. 키워드를 넣어야 설정 충돌 검토에서 이 규칙으로 위반 여부를 판정해요.</p>
                  )}
                </div>
                {selected.evidence && (
                  <div className="evidence-box">
                    원문 근거{selected.source_chapter ? ` · ${selected.source_chapter}장` : ''} “{selected.evidence}”
                    {latest && selected.source_chapter && (
                      <>
                        {' '}
                        <Link
                          className="text-link"
                          to={`${projectPath(projectId, `manuscripts/${latest.manuscript_id}`)}?chapter=${selected.source_chapter}`}
                          state={{ highlight: selected.evidence }}
                        >
                          {selected.source_chapter}장 원문 보기
                        </Link>
                      </>
                    )}
                  </div>
                )}
                {error && <p className="notice notice--error">{error}</p>}
                {canEdit && (
                  <div className="actions-row">
                    <Button tone="outline" onClick={() => setEditing({ title: selected.title, description: selected.description, keywords: selected.violation_keywords.join(', ') })}>
                      내용 수정
                    </Button>
                    {selected.status === 'pending' ? (
                      <>
                        <Button tone="outline" onClick={() => act((t) => api.ignoreRule(t, projectId, selected.rule_id))} disabled={busy}>
                          무시
                        </Button>
                        <Button onClick={() => act((t) => api.confirmRule(t, projectId, selected.rule_id))} busy={busy}>
                          규칙으로 확정
                        </Button>
                      </>
                    ) : (
                      <Button tone="error" onClick={() => act((t) => api.deleteRule(t, projectId, selected.rule_id).then(() => null), () => setParams({}, { replace: true }))} disabled={busy}>
                        규칙 삭제
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        ) : null}
      </div>
    </div>
  )
}

function RuleFields({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  return (
    <>
      <label className="field">
        <span className="field__label">이름 · 선택</span>
        <input className="char-search" value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} placeholder="붉은 문" />
      </label>
      <label className="field">
        <span className="field__label">규칙 내용</span>
        <TextArea className="nl-textarea" style={{ minHeight: 90 }} value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} placeholder="붉은 문은 비가 그친 뒤에만 열린다" />
      </label>
      <label className="field">
        <span className="field__label">위반 판정 키워드 · 쉼표로 구분</span>
        <input className="char-search" value={draft.keywords} onChange={(e) => onChange({ ...draft, keywords: e.target.value })} placeholder="비 오는 중에 열림, 맑은 날 개방" />
      </label>
    </>
  )
}
