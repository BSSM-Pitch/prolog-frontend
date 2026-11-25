import { useEffect, useRef, useState, type FormEvent } from 'react'
import { IS_REAL } from '../../api/config'
import type { Chapter } from '../../api/types'
import type * as api from '../../api/relationships'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { TextArea } from '../../components/TextArea'
import { describeError } from '../../lib/errors'
import { InsightDialog } from '../insights/InsightDialog'
import { useRelationshipDraft } from './useRelationshipDraft'

export function AddRelationship({
  projectId, manuscriptId, chapterRows,
  people,
  chapter,
  chapters,
  onCancel,
  onSubmit,
}: {
  projectId: string
  manuscriptId: string
  chapterRows: Chapter[]
  people: Array<{ character_id: string; name: string }>
  chapter: number
  chapters: number[]
  onCancel: () => void
  onSubmit: (input: {
    source_character_id: string
    target_character_id: string
    initial_history: api.EntryInput
  }) => Promise<void>
}) {
  const [a, setA] = useState(IS_REAL ? '' : people[0]?.character_id ?? '')
  const [b, setB] = useState(IS_REAL ? '' : people[1]?.character_id ?? '')
  const [first, setFirst] = useState(String(chapters.includes(chapter) ? chapter : chapters[0] ?? ''))
  const [state, setState] = useState('')
  const [trust, setTrust] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [event, setEvent] = useState('')
  const [manual, setManual] = useState(false)
  const draft = useRelationshipDraft(projectId, manuscriptId, chapterRows.find((row) => row.chapter_no === Number(first))?.chapter_id ?? '')
  const applied = useRef<string | null>(null)
  const drafting = draft.busy && !manual
  useEffect(() => {
    const job = draft.job
    if (manual || !job?.result || job.stale || applied.current === job.draft_id) return
    applied.current = job.draft_id
    const suggestion = job.result
    setA(suggestion.source_character_id ?? '')
    setB(suggestion.target_character_id ?? '')
    setState(suggestion.state)
    setTrust(suggestion.trust == null ? '' : String(suggestion.trust))
    setEvent(suggestion.event_title)
  }, [draft.job, manual])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || drafting) return
    if (!a || !b || !state.trim()) return setError('두 인물과 관계 상태를 확인해 주세요.')
    if (a === b) return setError('서로 다른 두 인물을 골라 주세요.')
    if (!chapters.includes(Number(first))) return setError('원고에 있는 장을 골라 주세요.')
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        source_character_id: a,
        target_character_id: b,
        initial_history: { chapter: Number(first), state: state.trim(), trust: trust === '' ? null : Number(trust), event_title: event },
      })
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }

  return (
    <InsightDialog title="관계 추가" onClose={onCancel} busy={busy}>
      {draft.available && <div className="evidence-box">
        <p role="status">{drafting ? '선택한 장을 읽고 관계 초안을 작성하고 있어요.' : 'AI 초안을 확인하고 수정한 뒤 등록해 주세요.'}</p>
        <p className="panel__label">선택한 장의 앞 12,000자까지 확인해요. 신뢰도는 검토용 추정치이며, 근거가 부족하면 비워 둬요.</p>
        {draft.error && <p className="notice notice--error" role="alert">{draft.error}</p>}
        {draft.job?.stale && <p role="alert">원고가 바뀌었어요. 현재 원고로 초안을 다시 작성해 주세요.</p>}
        {draft.job?.result && <>
          <p>{draft.job.result.explanation}</p>
          {draft.job.result.evidence.map((quote, index) => <blockquote key={index}>{quote}</blockquote>)}
        </>}
        <div className="actions-row">
          {draft.busy && <Button tone="outline" onClick={() => setManual(true)}>직접 입력하기</Button>}
          <Button tone="outline" disabled={draft.busy || busy} onClick={() => {
            setManual(false)
            applied.current = null
            void draft.generate(a && b && a !== b ? [a, b] : undefined, true)
          }}>{draft.job?.status === 'failed' ? '초안 다시 시도' : '선택한 인물로 초안 작성'}</Button>
        </div>
      </div>}
      <form className="insight-form" onSubmit={submit}>
        <fieldset className="two-col form-grid" disabled={busy || drafting} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          {[
            ['인물 A', a, setA],
            ['인물 B', b, setB],
          ].map(([label, value, setter]) => (
            <label key={label as string} className="field">
              <span className="field__label">{label as string}</span>
              <Select
                className="nl-select"
                value={value as string}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
              >
                <option value="">인물 선택</option>
                {people.map((p) => (
                  <option key={p.character_id} value={p.character_id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
          ))}
          <label className="field">
            <span className="field__label">첫 기록 장</span>
            <Select value={first} onChange={(e) => setFirst(e.target.value)}>
              {chapters.map((no) => <option key={no} value={no}>{no}장</option>)}
            </Select>
          </label>
          <label className="field">
            <span className="field__label">관계 상태</span>
            <input className="char-search" value={state} onChange={(e) => setState(e.target.value)} placeholder="예: 동맹, 갈등, 신뢰 회복" maxLength={50} required />
          </label>
          <label className="field">
            <span className="field__label">신뢰도 · 선택 · 0~100</span>
            <input
              className="char-search"
              type="number"
              min={0}
              max={100}
              value={trust}
              onChange={(e) => setTrust(e.target.value)}
            />
          </label>
        </fieldset>
        <label className="field">
          <span className="field__label">관계 변화 메모</span>
          <TextArea value={event} onChange={(e) => setEvent(e.target.value)} disabled={busy || drafting} maxLength={2000} />
        </label>
        {error && <p className="notice notice--error" role="alert">{error}</p>}
        <div className="dialog__actions">
          <Button tone="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" busy={busy} disabled={drafting || (!manual && Boolean(draft.job?.stale))}>
            관계 추가
          </Button>
        </div>
      </form>
    </InsightDialog>
  )
}
