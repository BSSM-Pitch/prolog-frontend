import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as api from '../../api/characters'
import { ApiError } from '../../api/client'
import type { CharacterCategory, DraftItem, EditHistoryEntry } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { describeError } from '../../lib/errors'
import { josa } from '../../lib/josa'
import { relativeTime } from '../../lib/relativeTime'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import { CATEGORIES, Stepper } from './shared'
import './characters.css'

type Editing = { kind: 'new' } | { kind: 'item'; itemId: string } | null
type Duplicate = { name: string; candidateId: string }

const itemLabel = (i: DraftItem) =>
  i.field === 'influence_relations' ? [i.value, i.type && i.type !== '영향' ? i.type : null, i.status ? `상태: ${i.status}` : null].filter(Boolean).join(' · ') : i.value

// Figma 842:1115 · 23 구조화 초안 검토 / 1266:3400 · 37 병합 선택
export function DraftPage() {
  const project = useProject()
  const navigate = useNavigate()
  const { draftId = '' } = useParams()
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const draft = useResource(project ? (t) => api.getDraft(t, projectId, draftId) : null, [projectId, draftId])
  const [editing, setEditing] = useState<Editing>(null)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [history, setHistory] = useState<EditHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null)
  const [resolution, setResolution] = useState<'merge' | 'create_new'>('merge')
  const [confirming, setConfirming] = useState(false)
  const [discardAsk, setDiscardAsk] = useState(false)

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>
  const d = draft.data
  const locked = d ? d.status !== 'pending_review' : true
  const selected = editing?.kind === 'item' ? d?.items.find((i) => i.item_id === editing.itemId) ?? null : null

  async function run<T>(fn: (token: string) => Promise<T>) {
    setError(null)
    try {
      const r = await withAuth(fn)
      if (history) setHistory(await withAuth((t) => api.getDraftHistory(t, projectId, draftId)))
      return r
    } catch (e) {
      setError(describeError(e))
      return null
    }
  }

  async function saveName() {
    if (nameDraft === null) return
    const next = await run((t) => api.renameDraft(t, projectId, draftId, nameDraft.trim()))
    if (next) {
      draft.setData(() => next)
      setNameDraft(null)
    }
  }

  async function removeItem(item: DraftItem) {
    const ok = await run((t) => api.deleteDraftItem(t, projectId, draftId, item.item_id))
    if (ok !== null) {
      draft.setData((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.item_id !== item.item_id) } : prev))
      if (selected?.item_id === item.item_id) setEditing(null)
    }
  }

  async function toggleHistory() {
    if (history) return setHistory(null)
    const h = await run((t) => api.getDraftHistory(t, projectId, draftId))
    if (h) setHistory(h)
  }

  async function confirm(body: { resolution?: 'merge' | 'create_new'; merge_target_character_id?: string } = {}) {
    if (!d?.character_name?.trim()) {
      setConfirmError('인물 이름은 필수예요. 이름을 입력한 뒤 확정해 주세요.')
      return
    }
    setConfirming(true)
    setConfirmError(null)
    try {
      const c = await withAuth((t) => api.confirmDraft(t, projectId, draftId, body))
      navigate(`${projectPath(projectId, 'characters')}?selected=${c.character_id}`, {
        replace: true,
        state: { notice: `${josa(c.name, '을/를')} 작품 세계에 반영했어요.` },
      })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DUPLICATE_CHARACTER_CANDIDATE') {
        setDuplicate({ name: String(e.details.candidate_name ?? d.character_name), candidateId: String(e.details.candidate_character_id) })
      } else {
        setConfirmError(e instanceof ApiError && e.code === 'MISSING_REQUIRED_FIELD' ? '인물 이름은 필수예요.' : describeError(e))
      }
    } finally {
      setConfirming(false)
    }
  }

  async function discard() {
    const r = await run((t) => api.discardDraft(t, projectId, draftId))
    setDiscardAsk(false)
    if (r) navigate(projectPath(projectId, 'characters'), { replace: true })
  }

  return (
    <div className="draft">
      <header>
        <p className="page-crumb">
          등장인물 / {d?.character_name ?? '새 인물'} · {locked ? (d?.status === 'confirmed' ? '확정됨' : d?.status === 'discarded' ? '폐기됨' : '') : '검토 대기'}
        </p>
        <h1 className="page-title">구조화 초안 검토</h1>
        <p className="page-desc">수정·삭제·추가 후 직접 확정한 항목만 작품 세계에 반영됩니다.</p>
      </header>
      <Stepper current={d?.status === 'confirmed' ? 4 : 3} />

      {draft.error && !d && (
        <div className="panel" role="alert">
          <p className="panel__title">초안을 열 수 없어요</p>
          <p className="page-desc">{draft.error}</p>
          <Link className="btn btn--outline" to={projectPath(projectId, 'characters')}>
            등장인물로 돌아가기
          </Link>
        </div>
      )}

      {d && (
        <div className="two-col">
          <section className="panel" aria-labelledby="draft-items-title">
            <h2 id="draft-items-title" className="panel__title">
              초안 항목 편집
            </h2>
            <p className="draft-note">{d.draft_id} · 화면을 벗어나면 미확정 초안으로 보관됩니다.</p>
            {locked && <p className="check-note">이미 {d.status === 'confirmed' ? '확정' : '폐기'}한 초안이라 고칠 수 없어요.</p>}

            <div className="draft-row draft-row--name">
              {nameDraft !== null ? (
                <>
                  <label className="visually-hidden" htmlFor="draft-name">
                    인물 이름
                  </label>
                  <input id="draft-name" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()} autoFocus />
                  <Button onClick={saveName}>저장</Button>
                  <Button tone="outline" onClick={() => setNameDraft(null)}>
                    취소
                  </Button>
                </>
              ) : (
                <>
                  <span className="draft-row__text">
                    <span className="panel__label">인물 이름 · 필수 </span>
                    {d.character_name ?? <em>이름 없음</em>}
                  </span>
                  {!locked && (
                    <Button tone="outline" onClick={() => setNameDraft(d.character_name ?? '')}>
                      이름 수정
                    </Button>
                  )}
                </>
              )}
            </div>

            <ul className="draft-list">
              {d.items.map((i) => (
                <li key={i.item_id} className="draft-row" aria-current={selected?.item_id === i.item_id || undefined}>
                  <span className="draft-row__text">
                    {CATEGORIES.find((c) => c.field === i.field)?.label} · {itemLabel(i)}
                  </span>
                  <span className={i.origin === 'ai_extracted' ? 'badge badge--done' : 'badge badge--outline'}>{i.origin === 'ai_extracted' ? 'AI 추출' : '직접 추가'}</span>
                  {!locked && (
                    <>
                      <Button tone="outline" onClick={() => setEditing({ kind: 'item', itemId: i.item_id })}>
                        수정
                      </Button>
                      <Button tone="error" onClick={() => removeItem(i)}>
                        삭제
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            {d.items.length === 0 && <p className="panel__label">항목이 없어요. 직접 추가해 보세요.</p>}
            {!locked && (
              <Button tone="secondary" block onClick={() => setEditing({ kind: 'new' })}>
                + 항목 추가
              </Button>
            )}
            {error && (
              <p className="notice notice--error" role="alert">
                {error}
              </p>
            )}
            {!locked && (
              <div className="draft-foot">
                <Button tone="error" onClick={() => setDiscardAsk(true)}>
                  초안 폐기
                </Button>
                <Button onClick={() => confirm()} busy={confirming}>
                  초안 확정
                </Button>
              </div>
            )}
          </section>

          <div className="nl-design">
            <ItemEditor
              key={editing?.kind === 'item' ? editing.itemId : editing?.kind ?? 'none'}
              editing={editing}
              item={selected}
              disabled={locked}
              onCancel={() => setEditing(null)}
              onSubmit={async (field, input) => {
                if (editing?.kind === 'item' && selected) {
                  const updated = await run((t) => api.updateDraftItem(t, projectId, draftId, selected.item_id, input))
                  if (updated) draft.setData((prev) => (prev ? { ...prev, items: prev.items.map((x) => (x.item_id === updated.item_id ? updated : x)) } : prev))
                } else {
                  const added = await run((t) => api.addDraftItem(t, projectId, draftId, { field, ...input }))
                  if (added) {
                    draft.setData((prev) => (prev ? { ...prev, items: [...prev.items, added] } : prev))
                    setEditing({ kind: 'item', itemId: added.item_id })
                  }
                }
              }}
              historyOpen={Boolean(history)}
              historyCount={history?.length ?? null}
              onToggleHistory={toggleHistory}
              history={history}
            />

            <section className="panel" aria-labelledby="check-title">
              <h2 id="check-title" className="panel__title">
                확정 전 확인
              </h2>
              <p className="page-desc">AI는 초안을 임의로 확정하지 않습니다.</p>
              <p className="check-note">인물 이름은 필수예요. 같은 이름의 확정 인물이 있으면 병합할지 새로 만들지 먼저 고르게 돼요.</p>
              {confirmError && (
                <div className="check-note check-note--error" role="alert">
                  <strong>확정하지 못했어요</strong>
                  <br />
                  {confirmError} 편집한 내용은 그대로 남아 있어요.
                </div>
              )}
              {confirmError && (
                <Button tone="secondary" block onClick={() => confirm()} busy={confirming}>
                  다시 시도
                </Button>
              )}
            </section>
          </div>
        </div>
      )}

      {duplicate && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setDuplicate(null)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dup-title" onKeyDown={(e) => e.key === 'Escape' && setDuplicate(null)}>
            <h2 id="dup-title" className="panel__title">
              같은 이름의 인물이 있어요
            </h2>
            <p className="page-desc">확정된 인물 {josa(duplicate.name, '와/과')} 이름이 같아요. 이 초안을 어떻게 저장할지 골라 주세요.</p>
            <div className="choice-list" role="radiogroup" aria-label="저장 방법">
              <button type="button" role="radio" aria-checked={resolution === 'merge'} className="option" onClick={() => setResolution('merge')}>
                <span className="option__title">기존 {duplicate.name}에게 합치기</span>
                <span className="option__body">초안의 성격·가치관·관계·감정 항목을 기존 인물에 더해요.</span>
              </button>
              <button type="button" role="radio" aria-checked={resolution === 'create_new'} className="option" onClick={() => setResolution('create_new')}>
                <span className="option__title">새 인물로 만들기</span>
                <span className="option__body">같은 이름의 인물이 하나 더 생겨요.</span>
              </button>
            </div>
            <div className="dialog__actions">
              <Button tone="outline" onClick={() => setDuplicate(null)}>
                취소
              </Button>
              <Button
                busy={confirming}
                onClick={async () => {
                  const body = resolution === 'merge' ? { resolution, merge_target_character_id: duplicate.candidateId } : { resolution }
                  setDuplicate(null)
                  await confirm(body)
                }}
              >
                확정하기
              </Button>
            </div>
          </div>
        </div>
      )}

      {discardAsk && (
        <ConfirmDialog
          title="초안을 폐기할까요?"
          body="추출한 항목과 편집한 내용이 모두 사라지고 되돌릴 수 없어요."
          confirmLabel="폐기"
          onConfirm={discard}
          onCancel={() => setDiscardAsk(false)}
        />
      )}
    </div>
  )
}

interface ItemEditorProps {
  editing: Editing
  item: DraftItem | null
  disabled: boolean
  onCancel: () => void
  onSubmit: (field: CharacterCategory, input: { value?: string; target?: string; type?: string; status?: string | null }) => Promise<void>
  historyOpen: boolean
  historyCount: number | null
  onToggleHistory: () => void
  history: EditHistoryEntry[] | null
}

/** 선택 항목 편집 + 편집 이력 */
function ItemEditor({ editing, item, disabled, onCancel, onSubmit, historyOpen, onToggleHistory, history }: ItemEditorProps) {
  const [field, setField] = useState<CharacterCategory>(item?.field ?? 'personality_tags')
  const [value, setValue] = useState(item?.value ?? '')
  const [type, setType] = useState(item?.type ?? '영향')
  const [status, setStatus] = useState(item?.status ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isInfluence = field === 'influence_relations'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) return setError('값을 입력해 주세요.')
    setBusy(true)
    setError(null)
    await onSubmit(field, isInfluence ? { target: value.trim(), type: type.trim() || '영향', status: status.trim() || null } : { value: value.trim() })
    setBusy(false)
  }

  return (
    <section className="panel" aria-labelledby="editor-title">
      <h2 id="editor-title" className="panel__title">
        {editing?.kind === 'new' ? '항목 추가' : '선택 항목 편집'}
      </h2>
      {!editing ? (
        <p className="panel__label">왼쪽에서 수정할 항목을 고르거나 항목을 추가하세요.</p>
      ) : (
        <form className="nl-design" style={{ gap: 12 }} onSubmit={submit} noValidate>
          <label className="field">
            <span className="field__label">카테고리</span>
            <select className="nl-select" value={field} onChange={(e) => setField(e.target.value as CharacterCategory)} disabled={editing.kind === 'item' || disabled}>
              {CATEGORIES.map((c) => (
                <option key={c.field} value={c.field}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{isInfluence ? '영향을 준 대상' : '값'}</span>
            <input className="char-search" value={value} onChange={(e) => setValue(e.target.value)} disabled={disabled} />
          </label>
          {isInfluence && (
            <div className="two-col" style={{ gap: 8 }}>
              <label className="field">
                <span className="field__label">관계 유형</span>
                <input className="char-search" value={type} onChange={(e) => setType(e.target.value)} disabled={disabled} />
              </label>
              <label className="field">
                <span className="field__label">대상의 현재 상태</span>
                <input className="char-search" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="예: 고인" disabled={disabled} />
              </label>
            </div>
          )}
          {item?.evidence && <p className="evidence-box">원문 근거 “{item.evidence}”</p>}
          {error && <p className="notice notice--error">{error}</p>}
          <div className="actions-row">
            <Button tone="outline" onClick={onCancel}>
              닫기
            </Button>
            <Button type="submit" busy={busy} disabled={disabled}>
              {editing.kind === 'new' ? '항목 추가' : '변경 적용'}
            </Button>
          </div>
        </form>
      )}
      <Button tone="secondary" block onClick={onToggleHistory} aria-expanded={historyOpen}>
        {historyOpen ? '편집 이력 접기' : '편집 이력 펼치기'}
      </Button>
      {history && (
        <ul className="history">
          {history.length === 0 && <li>아직 편집한 내용이 없어요.</li>}
          {history.map((h, i) => (
            <li key={i}>
              {h.action === 'added' ? '추가' : h.action === 'removed' ? '삭제' : '수정'} · {h.field} · {h.value}
              <time dateTime={h.at}>{relativeTime(h.at)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
