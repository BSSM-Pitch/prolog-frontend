import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as api from '../../api/characters'
import type { NLExtraction } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { describeError, errorCode } from '../../lib/errors'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import { CATEGORIES, Stepper } from './shared'
import '../manuscripts/answer.css'
import './characters.css'

const EXAMPLE = '윤서는 신중하지만 집요하고, 약속을 무엇보다 중요하게 여긴다. 재현의 선택에 영향을 받았으며 붉은 문 앞에서 불안을 느낀다.'

// Figma 842:994 · 22 자연어로 인물 설계
export function NewCharacterPage() {
  const project = useProject()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const characters = useResource(project ? (t) => api.listCharacters(t, projectId) : null, [projectId])
  const [mode, setMode] = useState<'new' | 'existing'>(params.get('target') ? 'existing' : 'new')
  const [targetId, setTargetId] = useState(params.get('target') ?? '')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<{ name?: string; text?: string }>({})
  const [extraction, setExtraction] = useState<NLExtraction | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [forwarding, setForwarding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyzing = extraction?.status === 'analyzing'
  const extractionId = extraction?.extraction_id

  // 추출이 끝날 때까지 1초마다 상태를 확인한다 (NLCD 4.2)
  useEffect(() => {
    if (!analyzing || !extractionId) return
    const id = window.setInterval(() => {
      withAuth((t) => api.getExtraction(t, projectId, extractionId))
        .then(setExtraction)
        .catch((e) => setError(describeError(e)))
    }, 1000)
    return () => window.clearInterval(id)
  }, [analyzing, extractionId, projectId, withAuth])

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>
  const existing = characters.data ?? []
  const target = existing.find((c) => c.character_id === targetId)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next = {
      name: mode === 'new' && !name.trim() ? '인물 이름을 입력해 주세요.' : undefined,
      text: !text.trim() ? '인물을 설명하는 문장을 입력해 주세요.' : undefined,
    }
    if (mode === 'existing' && !targetId) next.name = '정보를 더할 인물을 골라 주세요.'
    setErrors(next)
    if (next.name || next.text) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await withAuth((t) =>
        api.createExtraction(t, projectId, {
          source_text: text.trim(),
          character_name: mode === 'new' ? name.trim() : target?.name,
          target_character_id: mode === 'existing' ? targetId : null,
        }),
      )
      setExtraction(res)
      if (res.duplicate_of) setNotice('이전에 비슷한 문장을 입력한 기록이 있어요. 초안을 확정할 때 병합 여부를 고를 수 있어요.')
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function retry() {
    if (!extraction) return
    setError(null)
    try {
      setExtraction(await withAuth((t) => api.retryExtraction(t, projectId, extraction.extraction_id)))
    } catch (err) {
      setError(describeError(err))
    }
  }

  async function forward() {
    if (!extraction) return
    setForwarding(true)
    setError(null)
    try {
      const res = await withAuth((t) => api.forwardExtraction(t, projectId, extraction.extraction_id))
      navigate(projectPath(projectId, `characters/drafts/${res.forwarded_draft_id}`))
    } catch (err) {
      if (errorCode(err) === 'ALREADY_FORWARDED') {
        const id = (err as { details?: { forwarded_draft_id?: string } }).details?.forwarded_draft_id
        if (id) return navigate(projectPath(projectId, `characters/drafts/${id}`))
      }
      setError(describeError(err))
      setForwarding(false)
    }
  }

  const done = extraction?.status === 'completed'
  const empty = done && CATEGORIES.every((c) => extraction[c.field].length === 0)

  return (
    <div className="nl-design">
      <header>
        <p className="page-crumb">등장인물 / {mode === 'new' ? '새 인물' : `${target?.name ?? '기존 인물'}에 추가`}</p>
        <h1 className="page-title">자연어로 인물 설계</h1>
        <p className="page-desc">인물을 문장으로 설명하고 원문 근거가 있는 항목만 검토하세요.</p>
      </header>
      <Stepper current={done ? 2 : 1} />

      <div className="two-col">
        <form className="panel" onSubmit={onSubmit} noValidate>
          <h2 className="panel__title">자연어 입력</h2>
          <div className="segmented segmented--wide" role="radiogroup" aria-label="만들 방식">
            {(['new', 'existing'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} disabled={m === 'existing' && existing.length === 0}>
                {m === 'new' ? '새 인물' : '기존 인물에 추가'}
              </button>
            ))}
          </div>
          {mode === 'new' ? (
            <TextField
              label="인물 이름"
              value={name}
              onChange={(v) => {
                setName(v)
                setErrors((e) => ({ ...e, name: undefined }))
              }}
              error={errors.name}
              placeholder="윤서"
            />
          ) : (
            <label className="field">
              <span className="field__label">정보를 더할 인물</span>
              <select className="nl-select" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">인물 선택</option>
                {existing.map((c) => (
                  <option key={c.character_id} value={c.character_id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.name && <span className="field__hint notice--error">{errors.name}</span>}
            </label>
          )}
          <label className="field">
            <span className="field__label">인물 설명</span>
            <textarea
              className="nl-textarea"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setErrors((x) => ({ ...x, text: undefined }))
              }}
              placeholder={EXAMPLE}
              aria-invalid={Boolean(errors.text) || undefined}
            />
            {errors.text && <span className="notice notice--error">{errors.text}</span>}
          </label>
          {!text && (
            <button type="button" className="text-link" onClick={() => setText(EXAMPLE)}>
              예시 문장 넣기
            </button>
          )}
          <Button type="submit" block busy={busy || analyzing}>
            {analyzing ? '추출하는 중…' : '추출 미리보기'}
          </Button>
        </form>

        <section className="panel" aria-labelledby="preview-title" aria-live="polite">
          <h2 id="preview-title" className="panel__title">
            추출 미리보기{done ? ` / ${CATEGORIES.length}개 카테고리` : ''}
          </h2>
          {notice && <p className="check-note">{notice}</p>}
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}

          {!extraction && (
            <div className="state-block">
              <p className="answer__title">문장을 입력하고 추출 미리보기를 눌러 보세요</p>
              <p className="answer__body">성격, 가치관, 영향 관계, 감정 키워드를 원문 근거와 함께 나눠 드려요.</p>
            </div>
          )}
          {analyzing && (
            <div className="state-block" role="status">
              <span className="answer__spinner" aria-hidden="true" />
              <p className="answer__title">문장에서 인물 정보를 읽고 있어요</p>
              <p className="answer__body">성격, 가치관, 영향 관계, 감정 키워드를 나누고 있어요.</p>
            </div>
          )}
          {extraction?.status === 'failed' && (
            <div className="state-block state-block--error" role="alert">
              <p className="answer__title">인물 정보를 읽지 못했어요</p>
              <p className="answer__body">입력한 문장은 그대로 남아 있어요.</p>
              <Button onClick={retry}>다시 시도</Button>
            </div>
          )}
          {empty && (
            <div className="state-block">
              <p className="answer__title">읽어 낼 정보가 부족해요</p>
              <p className="answer__body">성격이나 다른 인물과의 관계가 드러나는 문장을 조금 더 써 주세요.</p>
            </div>
          )}
          {done && !empty && (
            <>
              {CATEGORIES.map((c) => {
                const items = extraction[c.field]
                return (
                  <div key={c.field} className={items.length ? 'extract-card' : 'extract-card extract-card--empty'}>
                    <p className="extract-card__title">
                      {c.label} · {items.length ? items.map((i) => i.value).join(', ') : '찾지 못했어요'}
                    </p>
                    {/* 같은 구절에서 여러 항목이 나오면 근거는 한 번만 보여 준다 */}
                    {[...new Set(items.map((i) => i.evidence))].map((ev) => (
                      <p key={ev} className="extract-card__evidence">
                        근거 “{ev}”
                      </p>
                    ))}
                  </div>
                )
              })}
              <Button block onClick={forward} busy={forwarding}>
                구조화 초안 검토로 계속
              </Button>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
