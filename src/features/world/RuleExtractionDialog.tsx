import { useRef, useState, type FormEvent } from 'react'
import type { Manuscript } from '../../api/types'
import { listChapters } from '../../api/manuscripts'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { useResource } from '../../lib/useResource'
import { describeError } from '../../lib/errors'
import { InsightDialog } from '../insights/InsightDialog'
import { countRuleChars, MAX_RULE_EXTRACTION_CHARS, ruleExtractionSelection } from './ruleExtractionModel'
import '../insights/insights.css'
import './ruleExtraction.css'

export function RuleExtractionDialog({ projectId, manuscripts, onSubmit, onClose }: {
  projectId: string
  manuscripts: Manuscript[]
  onSubmit: (manuscriptId: string, chapterIds: string[]) => Promise<void>
  onClose: () => void
}) {
  const [manuscriptId, setManuscriptId] = useState(manuscripts[0]?.manuscript_id ?? '')
  const [busy, setBusy] = useState(false)
  return (
    <InsightDialog title="규칙을 추출할 장 선택" onClose={onClose} busy={busy}>
      <p className="page-desc">한 번에 30,000자까지 분석해요. 선택한 장의 내용에서만 규칙을 찾아요.</p>
      <label className="field">
        <span className="field__label">분석할 원고</span>
        <Select aria-label="분석할 원고" value={manuscriptId} onChange={(e) => setManuscriptId(e.target.value)} disabled={busy}>
          {manuscripts.map((m) => <option key={m.manuscript_id} value={m.manuscript_id}>{m.title}</option>)}
        </Select>
      </label>
      <ChapterSelection key={manuscriptId} projectId={projectId} manuscriptId={manuscriptId} onSubmit={onSubmit} onClose={onClose} busy={busy} setBusy={setBusy} />
    </InsightDialog>
  )
}

function ChapterSelection({ projectId, manuscriptId, onSubmit, onClose, busy, setBusy }: {
  projectId: string; manuscriptId: string
  onSubmit: (manuscriptId: string, chapterIds: string[]) => Promise<void>
  onClose: () => void; busy: boolean; setBusy: (value: boolean) => void
}) {
  const chapters = useResource((token) => listChapters(token, projectId, manuscriptId), [projectId, manuscriptId])
  const ordered = [...(chapters.data ?? [])].filter((c) => !c.chapter_id.startsWith('preview-')).sort((a, b) => a.chapter_no - b.chapter_no)
  const allIds = ordered.map((c) => c.chapter_id)
  const all = ruleExtractionSelection(ordered, allIds)
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null)
  const ids = selectedIds ?? (all.charCount <= MAX_RULE_EXTRACTION_CHARS ? allIds : [])
  const selection = ruleExtractionSelection(ordered, ids)
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || chapters.loading || chapters.error || selection.error) return
    lock.current = true; setBusy(true); setError(null)
    try {
      await onSubmit(manuscriptId, selection.selected.map((c) => c.chapter_id))
      onClose()
    } catch (e) { setError(describeError(e)) }
    finally { lock.current = false; setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="rule-extraction-form">
      {chapters.loading ? <p role="status">장을 불러오고 있어요…</p> : chapters.error ? (
        <div role="alert"><p className="notice notice--error">{chapters.error}</p><Button tone="outline" onClick={chapters.reload}>다시 불러오기</Button></div>
      ) : (
        <>
          <div className="actions-row">
            <Button tone="outline" disabled={busy || !ordered.length} onClick={() => setSelectedIds(allIds)}>전체 선택</Button>
            <Button tone="outline" disabled={busy || !ids.length} onClick={() => setSelectedIds([])}>선택 해제</Button>
          </div>
          <fieldset className="rule-extraction-chapters" disabled={busy}>
            <legend>분석할 장</legend>
            {ordered.map((c) => {
              const count = countRuleChars(c.content)
              return <label className="rule-extraction-chapter" key={c.chapter_id}>
                <input type="checkbox" checked={ids.includes(c.chapter_id)} onChange={(e) => setSelectedIds(e.target.checked ? [...ids, c.chapter_id] : ids.filter((id) => id !== c.chapter_id))} />
                <span>{c.chapter_no}장{c.title && c.title !== `${c.chapter_no}장` ? ` · ${c.title}` : ''}</span>
                <span className="panel__label">{count.toLocaleString()}자{count > MAX_RULE_EXTRACTION_CHARS ? ' · 한도 초과' : ''}</span>
              </label>
            })}
            {!ordered.length && <p>분석할 장이 없어요. 원고에 본문을 저장한 뒤 다시 열어 주세요.</p>}
          </fieldset>
          <p role="status" className={selection.charCount > MAX_RULE_EXTRACTION_CHARS ? 'notice notice--error' : 'panel__label'}>
            {selection.selected.length}개 장 선택 · {selection.charCount.toLocaleString()} / 30,000자
          </p>
          <p className="panel__label">공백과 줄바꿈을 포함해요. 장 사이에는 줄바꿈 2자가 들어가요.</p>
          {selection.error && <p className="notice notice--error">{selection.error}</p>}
          {ordered.some((c) => countRuleChars(c.content) > MAX_RULE_EXTRACTION_CHARS) && <p className="panel__label">한 장이 30,000자를 넘으면 원고에서 장을 나눈 뒤 선택해 주세요.</p>}
        </>
      )}
      {error && <p role="alert" className="notice notice--error">{error}</p>}
      <div className="dialog__actions">
        <Button tone="outline" disabled={busy} onClick={onClose}>취소</Button>
        <Button type="submit" busy={busy} disabled={busy || chapters.loading || Boolean(chapters.error) || Boolean(selection.error)}>{busy ? '요청 중…' : '선택한 장에서 추출'}</Button>
      </div>
    </form>
  )
}
