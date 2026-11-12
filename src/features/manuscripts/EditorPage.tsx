import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as api from '../../api/manuscripts'
import type { Chapter, Citation } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { ExportMenu } from '../../components/ExportMenu'
import { describeError } from '../../lib/errors'
import { relativeTime } from '../../lib/relativeTime'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import { AnswerCard } from './AnswerCard'
import { useAnswer } from './useAnswer'
import './EditorPage.css'
import './answer.css'
import { TextArea } from '../../components/TextArea'
import { Select } from '../../components/Select'
import { ReviewedManuscript } from './ReviewedManuscript'
import { exactMemoryRange } from './manuscriptReviewModel'
import { ChapterSaveQueue, selectedChapter, withCreatedChapters } from './chapterEditorModel'

type SaveState =
  | { kind: 'saved'; at: string }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }

const AUTOSAVE_MS = 900

// Figma 841:662 · 19 원고 편집기
export function EditorPage() {
  const project = useProject()
  const { manuscriptId = '' } = useParams()
  return <DocumentEditor key={`${project?.project_id ?? ''}/${manuscriptId}`} />
}

function DocumentEditor() {
  const project = useProject()
  const { manuscriptId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const sourceLink = useLocation().state as { highlight?: string; memoryRange?: { start: number; end: number } } | null
  const highlight = sourceLink?.highlight
  const memoryStart = sourceLink?.memoryRange?.start
  const memoryEnd = sourceLink?.memoryRange?.end
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const manuscript = useResource(project ? (t) => api.getManuscript(t, projectId, manuscriptId) : null, [
    projectId,
    manuscriptId,
  ])
  const chapters = useResource(project ? (t) => api.listChapters(t, projectId, manuscriptId) : null, [
    projectId,
    manuscriptId,
  ])
  const [createdChapters, setCreatedChapters] = useState<Record<string, Chapter>>({})
  const list = withCreatedChapters(chapters.data ?? [], createdChapters)
  const chapter = selectedChapter(list, params.get('chapter'))
  const ready = !manuscript.loading && !chapters.loading && !manuscript.error && !chapters.error
  const [transitioning, setTransitioning] = useState(false)
  const transition = useRef<{ no: number; id: string } | 'saving' | null>(null)
  const editable = ready && !transitioning && project?.my_role !== 'viewer'

  // 장별 편집 중인 본문. 저장이 끝나면 서버 값과 같아진다.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [save, setSave] = useState<SaveState | null>(null)
  const [adding, setAdding] = useState(false)
  const [composing, setComposing] = useState(false)
  const composingRef = useRef(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const queue = useRef(new ChapterSaveQueue())

  const text = chapter ? (drafts[chapter.chapter_id] ?? chapter.content) : ''

  async function flush(): Promise<boolean> {
    if (composingRef.current) return false
    if (!project) return false
    let lastSavedAt: string | null = null
    const success = await queue.current.flush(async (job) => {
      setSave({ kind: 'saving' })
      try {
        const saved = await withAuth((t) =>
          api.saveChapter(t, projectId, manuscriptId, job.chapterId, { content: job.content }),
        )
        chapters.setData((prev) => prev?.map((c) => (c.chapter_id === saved.chapter_id ? saved : c)) ?? null)
        lastSavedAt = saved.updated_at ?? new Date().toISOString()
      } catch (e) {
        setSave({ kind: 'error', message: describeError(e) })
        throw e
      }
    })
    if (success && lastSavedAt) setSave({ kind: 'saved', at: lastSavedAt })
    return success
  }

  useLayoutEffect(() => {
    const target = transition.current
    if (
      target &&
      target !== 'saving' &&
      ready &&
      chapter?.chapter_id === target.id &&
      Number(params.get('chapter')) === target.no
    ) {
      transition.current = null
      setTransitioning(false)
      setSave(null)
    }
  }, [ready, chapter?.chapter_id, params])

  function unlock() {
    transition.current = null
    setTransitioning(false)
  }

  // The document key keeps this queue bound to its original manuscript.
  const flushOnExit = useRef(flush)
  useLayoutEffect(() => {
    flushOnExit.current = flush
  })
  useEffect(
    () => () => {
      void flushOnExit.current()
    },
    [],
  )

  async function openStory() {
    if (!(await flush())) return
    const query = new URLSearchParams({ manuscript: manuscriptId })
    if (chapter) query.set('chapter', String(chapter.chapter_no))
    navigate(`${projectPath(projectId, 'story-map')}?${query}`)
  }

  // 입력이 멈추고 잠시 뒤 자동 저장
  useEffect(() => {
    if (save?.kind !== 'dirty' || composing) return
    const id = window.setTimeout(flush, AUTOSAVE_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, drafts, composing])

  // 저장하지 않은 내용이 있으면 창을 닫기 전에 확인
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (queue.current.dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  // AI 질문 화면의 "원문 보기"로 들어오면 근거 문장을 선택해 보여 준다
  const chapterId = chapter?.chapter_id
  useEffect(() => {
    if (!highlight || !chapterId) return
    const quote = memoryStart === undefined ? highlight.replace(/…$/, '') : highlight
    const id = window.setTimeout(() => {
      const el = textRef.current
      const exact =
        el && memoryStart !== undefined && memoryEnd !== undefined
          ? exactMemoryRange(el.value, quote, memoryStart, memoryEnd)
          : null
      const at = memoryStart === undefined ? (el?.value.indexOf(quote) ?? -1) : (exact?.start ?? -1)
      if (el && at >= 0) {
        el.focus()
        el.setSelectionRange(at, exact?.end ?? at + quote.length)
      }
    }, 60)
    return () => window.clearTimeout(id)
  }, [highlight, chapterId, memoryStart, memoryEnd])

  function onType(value: string) {
    if (!chapter || !editable || transition.current) return
    setDrafts((d) => ({ ...d, [chapter.chapter_id]: value }))
    queue.current.enqueue(chapter.chapter_id, value)
    setSave({ kind: 'dirty' })
  }

  async function goToChapter(no: number, select?: string) {
    if (transition.current || !ready || composingRef.current) return
    const target = list.find((c) => c.chapter_no === no)
    if (!target || target.chapter_id === chapter?.chapter_id) return
    transition.current = 'saving'
    setTransitioning(true)
    if (!(await flush())) {
      unlock()
      return
    }
    transition.current = { no: target.chapter_no, id: target.chapter_id }
    setParams({ chapter: String(no) }, { replace: true })
    if (select) {
      // 장이 바뀐 뒤 근거 문장을 선택해 보여 준다
      window.setTimeout(() => {
        const el = textRef.current
        if (!el) return
        const at = el.value.indexOf(select.replace(/…$/, ''))
        if (at >= 0) {
          el.focus()
          el.setSelectionRange(at, at + select.replace(/…$/, '').length)
        }
      }, 60)
    }
  }

  async function addChapter() {
    if (!editable || transition.current || composingRef.current) return
    transition.current = 'saving'
    setTransitioning(true)
    setAdding(true)
    if (!(await flush())) {
      setAdding(false)
      unlock()
      return
    }
    try {
      const c = await withAuth((t) => api.addChapter(t, projectId, manuscriptId))
      transition.current = { no: c.chapter_no, id: c.chapter_id }
      setCreatedChapters((prev) => ({ ...prev, [c.chapter_id]: c }))
      chapters.setData((prev) => [...(prev ?? []).filter((old) => old.chapter_id !== c.chapter_id), c])
      setParams({ chapter: String(c.chapter_no) }, { replace: true })
    } catch (e) {
      unlock()
      setSave({ kind: 'error', message: describeError(e) })
    } finally {
      setAdding(false)
    }
  }

  if (!project) return <p className="page-desc">작품을 불러오고 있어요</p>
  const ms = manuscript.data
  const loadError = manuscript.error ?? chapters.error
  const canEdit = project.my_role !== 'viewer'

  return (
    <div className="editor">
      <header className="editor__page-head">
        <div>
          <p className="page-crumb">
            <Link to={projectPath(projectId)}>{project.title}</Link> / 원고
          </p>
          <h1 className="page-title">{ms?.title ?? '원고'}</h1>
        </div>
        {ms?.status === 'ready' && (
          <div className="editor__page-actions">
            <ExportMenu projectId={projectId} manuscriptId={manuscriptId} title={ms.title} beforeExport={flush} align="end" />
            <Button tone="outline" onClick={openStory}>
              작품 살펴보기
            </Button>
          </div>
        )}
      </header>

      {loadError && !ms && (
        <div className="panel" role="alert">
          <p className="panel__title">원고를 열 수 없어요</p>
          <p className="page-desc">{loadError}</p>
          <Link className="btn btn--outline" to={projectPath(projectId, 'manuscripts')}>
            원고 목록으로
          </Link>
        </div>
      )}

      {ms && ms.status !== 'ready' && (
        <div className="panel" role="status">
          <p className="panel__title">
            {ms.status === 'processing' ? '아직 텍스트를 추출하고 있어요' : '이 원고는 텍스트 추출에 실패했어요'}
          </p>
          <Link className="btn btn--outline" to={projectPath(projectId, 'manuscripts')}>
            원고 업로드 화면으로
          </Link>
        </div>
      )}

      {ms && ms.status === 'ready' && (
        <div className="editor__layout">
          <section className="panel editor__paper" aria-label="원고">
            <div className="editor__head">
              <div className="editor__head-title">
                <label className="visually-hidden" htmlFor="chapter-select">
                  장 선택
                </label>
                <Select
                  id="chapter-select"
                  className="editor__chapter"
                  value={chapter?.chapter_no ?? ''}
                  onChange={(e) => goToChapter(Number(e.target.value))}
                  disabled={!ready || transitioning || composing || list.length === 0}
                >
                  {list.map((c) => (
                    <option key={c.chapter_id} value={c.chapter_no}>
                      {c.chapter_no}장{c.title && c.title !== `${c.chapter_no}장` ? ` · ${c.title}` : ''}
                    </option>
                  ))}
                </Select>
                {canEdit && (
                  <Button tone="soft" onClick={addChapter} busy={adding} disabled={!editable || composing}>
                    + 장 추가
                  </Button>
                )}
              </div>
              <div className="editor__badges" role="status">
                <SaveStatus state={save} fallbackAt={chapter?.updated_at ?? null} onRetry={flush} />
              </div>
            </div>

            {transitioning && (
              <p className="page-desc" role="status">
                장을 전환하고 있어요. 저장을 마칠 때까지 편집을 잠갔어요.
              </p>
            )}
            {ready && chapter ? (
              <ReviewedManuscript
                key={chapter.chapter_id}
                projectId={projectId}
                manuscriptId={manuscriptId}
                chapterId={chapter.chapter_id}
                chapterNo={chapter.chapter_no}
                textRef={textRef}
                value={text}
                onChange={onType}
                onCompositionChange={(active) => {
                  composingRef.current = active
                  setComposing(active)
                }}
                beforeCheck={flush}
                readOnly={!editable}
                onOpenReview={async (conflict) => {
                  if (!(await flush())) return
                  const query = new URLSearchParams({
                    manuscript: manuscriptId,
                    chapter: String(chapter.chapter_no),
                    focus: conflict.conflict_id,
                  })
                  navigate(`${projectPath(projectId, 'conflicts')}?${query}`)
                }}
              />
            ) : (
              <p className="page-desc" role="status">
                {loadError ??
                  (ready && params.has('chapter')
                    ? '요청한 장을 찾을 수 없어요. 장 목록에서 다시 선택해 주세요.'
                    : '장을 불러오고 있어요')}
              </p>
            )}

            <div className="editor__foot">
              <span className="panel__label">{text.length.toLocaleString()}자</span>
              <Link className="text-link" to={projectPath(projectId, `manuscripts/${manuscriptId}/history`)}>
                편집 이력
              </Link>
              {!canEdit && <span className="panel__label">보기 전용이라 수정할 수 없어요</span>}
            </div>
          </section>

          <AskPanel
            projectId={projectId}
            manuscriptId={manuscriptId}
            key={chapter?.chapter_id ?? 'loading'}
            chapter={ready && !transitioning ? chapter : null}
            blocked={!ready || transitioning || !chapter}
            textRef={textRef}
            beforeAsk={flush}
            onOpenCitation={(c) => goToChapter(c.chapter_no, c.quote)}
          />
        </div>
      )}
    </div>
  )
}

function SaveStatus({
  state,
  fallbackAt,
  onRetry,
}: {
  state: SaveState | null
  fallbackAt: string | null
  onRetry: () => void
}) {
  if (state?.kind === 'saving' || state?.kind === 'dirty') return <span className="page-crumb">저장 중…</span>
  if (state?.kind === 'error') {
    return (
      <button type="button" className="badge badge--error editor__retry" onClick={onRetry} title={state.message}>
        저장하지 못했어요 · 다시 시도
      </button>
    )
  }
  const at = state?.kind === 'saved' ? state.at : fallbackAt
  return <span className="page-crumb">자동 저장됨{at ? ` · ${relativeTime(at)}` : ''}</span>
}

interface AskPanelProps {
  projectId: string
  manuscriptId: string
  chapter: Chapter | null
  blocked: boolean
  textRef: RefObject<HTMLTextAreaElement | null>
  beforeAsk: () => Promise<boolean>
  onOpenCitation: (c: Citation) => void
}

/** 선택 문장에 질문하기 + 최근 답변 */
function AskPanel({ projectId, manuscriptId, chapter, blocked, textRef, beforeAsk, onOpenCitation }: AskPanelProps) {
  const { withAuth } = useSession()
  const [question, setQuestion] = useState('')
  const [selection, setSelection] = useState<{ chapterId: string; start: number; end: number; text: string } | null>(
    null,
  )
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState<{ threadId: string; messageId: string; question: string } | null>(null)
  const answer = useAnswer(target && { projectId, manuscriptId, ...target }, null)

  // 본문에서 드래그한 문장을 질문 범위로 잡는다
  useEffect(() => {
    const el = textRef.current
    if (!el || !chapter) return
    const onSelect = () => {
      const { selectionStart: start, selectionEnd: end } = el
      setSelection(
        end - start >= 2 ? { chapterId: chapter.chapter_id, start, end, text: el.value.slice(start, end) } : null,
      )
    }
    el.addEventListener('select', onSelect)
    el.addEventListener('mouseup', onSelect)
    el.addEventListener('keyup', onSelect)
    return () => {
      el.removeEventListener('select', onSelect)
      el.removeEventListener('mouseup', onSelect)
      el.removeEventListener('keyup', onSelect)
    }
  }, [textRef, chapter])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (blocked) return
    const q = question.trim()
    if (!q) {
      setError('질문을 입력해 주세요.')
      return
    }
    setSending(true)
    setError(null)
    try {
      // 선택 범위가 저장된 본문과 맞도록 먼저 저장한다.
      if (!(await beforeAsk())) {
        setError('원고를 저장하지 못했어요. 저장을 마친 뒤 다시 질문해 주세요.')
        return
      }
      const res = await withAuth((t) =>
        api.createThread(
          t,
          projectId,
          manuscriptId,
          selection
            ? {
                question: q,
                scope: 'selection',
                chapter_id: selection.chapterId,
                selection_range: { start: selection.start, end: selection.end },
              }
            : { question: q, scope: 'whole' },
        ),
      )
      const assistant = res.messages.find((m) => m.role === 'assistant')
      if (assistant) {
        setTarget({ threadId: res.thread.thread_id, messageId: assistant.message_id, question: q })
        answer.setMessage(assistant)
      }
      setQuestion('')
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <aside className="editor__side">
      <form className="panel" onSubmit={onSubmit} noValidate>
        <h2 className="panel__title">원고에 물어보기</h2>
        {selection ? (
          <p className="editor__selection">
            <span className="panel__label">선택한 문장</span>“
            {selection.text.length > 60 ? `${selection.text.slice(0, 58)}…` : selection.text}”
            <button type="button" className="text-link" onClick={() => setSelection(null)}>
              선택 해제
            </button>
          </p>
        ) : (
          <p className="panel__label">문장을 선택하면 그 부분을 중심으로 살펴봐요.</p>
        )}
        <label className="field">
          <span className="field__label">질문</span>
          <TextArea
            className="editor__question"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
            }}
            placeholder="앞선 설정과 다른 부분이 있어?"
            rows={3}
          />
        </label>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" block busy={sending} disabled={blocked}>
          {sending ? '보내는 중…' : '질문 보내기'}
        </Button>
      </form>

      {target && (
        <section className="panel" aria-labelledby="recent-answer">
          <div className="editor__answer-head">
            <h2 id="recent-answer" className="panel__title">
              최근 답변
            </h2>
            <Link className="text-link" to={`${projectPath(projectId, 'ask')}?manuscript=${manuscriptId}`}>
              대화 전체 보기
            </Link>
          </div>
          <p className="editor__asked">{target.question}</p>
          <AnswerCard
            message={answer.message}
            error={answer.error}
            onRetry={answer.retry}
            onOpenCitation={onOpenCitation}
            onEditQuestion={() => setQuestion(target.question)}
          />
        </section>
      )}
      {!target && (
        <Link className="text-link" to={`${projectPath(projectId, 'ask')}?manuscript=${manuscriptId}`}>
          이전 대화 보기
        </Link>
      )}
    </aside>
  )
}
