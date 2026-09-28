import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import * as api from '../../api/manuscripts'
import type { Chapter, Citation } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { relativeTime } from '../../lib/relativeTime'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import { AnswerCard } from './AnswerCard'
import { useAnswer } from './useAnswer'
import './EditorPage.css'
import './answer.css'

type SaveState = { kind: 'saved'; at: string } | { kind: 'dirty' } | { kind: 'saving' } | { kind: 'error'; message: string }

const SOURCE_LABEL = { file: '파일 업로드본', editor: '편집기 작성본' } as const
const AUTOSAVE_MS = 900

// Figma 841:662 · 19 원고 편집기
export function EditorPage() {
  const project = useProject()
  const { manuscriptId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const highlight = (useLocation().state as { highlight?: string } | null)?.highlight
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const manuscript = useResource(project ? (t) => api.getManuscript(t, projectId, manuscriptId) : null, [projectId, manuscriptId])
  const chapters = useResource(project ? (t) => api.listChapters(t, projectId, manuscriptId) : null, [projectId, manuscriptId])
  const list = chapters.data ?? []
  const requested = Number(params.get('chapter'))
  const chapter = list.find((c) => c.chapter_no === requested) ?? list[list.length - 1] ?? null

  // 장별 편집 중인 본문. 저장이 끝나면 서버 값과 같아진다.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [save, setSave] = useState<SaveState | null>(null)
  const [adding, setAdding] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const pendingSave = useRef<{ chapterId: string; content: string } | null>(null)

  const text = chapter ? (drafts[chapter.chapter_id] ?? chapter.content) : ''

  async function flush() {
    const job = pendingSave.current
    if (!job || !project) return
    pendingSave.current = null
    setSave({ kind: 'saving' })
    try {
      const saved = await withAuth((t) => api.saveChapter(t, projectId, manuscriptId, job.chapterId, { content: job.content }))
      chapters.setData((prev) => prev?.map((c) => (c.chapter_id === saved.chapter_id ? saved : c)) ?? null)
      setSave(pendingSave.current ? { kind: 'dirty' } : { kind: 'saved', at: saved.updated_at ?? new Date().toISOString() })
    } catch (e) {
      pendingSave.current = pendingSave.current ?? job
      setSave({ kind: 'error', message: describeError(e) })
    }
  }

  // 입력이 멈추고 잠시 뒤 자동 저장
  useEffect(() => {
    if (save?.kind !== 'dirty') return
    const id = window.setTimeout(flush, AUTOSAVE_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, drafts])

  // 저장하지 않은 내용이 있으면 창을 닫기 전에 확인
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pendingSave.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  // AI 질문 화면의 "원문 보기"로 들어오면 근거 문장을 선택해 보여 준다
  const chapterId = chapter?.chapter_id
  useEffect(() => {
    if (!highlight || !chapterId) return
    const quote = highlight.replace(/…$/, '')
    const id = window.setTimeout(() => {
      const el = textRef.current
      const at = el?.value.indexOf(quote) ?? -1
      if (el && at >= 0) {
        el.focus()
        el.setSelectionRange(at, at + quote.length)
      }
    }, 60)
    return () => window.clearTimeout(id)
  }, [highlight, chapterId])

  function onType(value: string) {
    if (!chapter) return
    setDrafts((d) => ({ ...d, [chapter.chapter_id]: value }))
    pendingSave.current = { chapterId: chapter.chapter_id, content: value }
    setSave({ kind: 'dirty' })
  }

  async function goToChapter(no: number, select?: string) {
    await flush()
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
    await flush()
    setAdding(true)
    try {
      const c = await withAuth((t) => api.addChapter(t, projectId, manuscriptId))
      chapters.setData((prev) => [...(prev ?? []), c])
      setParams({ chapter: String(c.chapter_no) }, { replace: true })
    } catch (e) {
      setSave({ kind: 'error', message: describeError(e) })
    } finally {
      setAdding(false)
    }
  }

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>
  const ms = manuscript.data
  const loadError = manuscript.error ?? chapters.error
  const canEdit = project.my_role !== 'viewer'

  return (
    <div className="editor">
      <header>
        <p className="page-crumb">
          쓰기 / {project.title}
          {chapter ? ` / ${chapter.chapter_no}장` : ''}
        </p>
        <h1 className="page-title">원고 편집기</h1>
        <p className="page-desc">집필에 집중하고, 필요한 순간에 AI 제안을 확인하세요.</p>
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
          <p className="panel__title">{ms.status === 'processing' ? '아직 텍스트를 추출하고 있어요' : '이 원고는 텍스트 추출에 실패했어요'}</p>
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
                <span className="panel__title">{project.title} /</span>
                <select
                  id="chapter-select"
                  className="editor__chapter"
                  value={chapter?.chapter_no ?? ''}
                  onChange={(e) => goToChapter(Number(e.target.value))}
                  disabled={list.length === 0}
                >
                  {list.map((c) => (
                    <option key={c.chapter_id} value={c.chapter_no}>
                      {c.chapter_no}장{c.title && c.title !== `${c.chapter_no}장` ? ` · ${c.title}` : ''}
                    </option>
                  ))}
                </select>
                {canEdit && (
                  <Button tone="soft" onClick={addChapter} busy={adding}>
                    + 장 추가
                  </Button>
                )}
              </div>
              <div className="editor__badges">
                <span className="badge badge--filled">
                  {SOURCE_LABEL[ms.source_type]}
                  {ms.file_format ? ` · ${ms.file_format.toUpperCase()}` : ''}
                </span>
                <SaveBadge state={save} fallbackAt={chapter?.updated_at ?? null} onRetry={flush} />
              </div>
            </div>

            {chapter ? (
              <textarea
                ref={textRef}
                className="editor__text"
                value={text}
                onChange={(e) => onType(e.target.value)}
                onBlur={flush}
                readOnly={!canEdit}
                aria-label={`${chapter.chapter_no}장 본문`}
                placeholder="여기에 이야기를 써 보세요."
                spellCheck={false}
              />
            ) : (
              <p className="page-desc">장을 불러오고 있어요</p>
            )}

            <div className="editor__foot">
              <Link className="btn btn--secondary" to={projectPath(projectId, `manuscripts/${manuscriptId}/history`)}>
                전체 이력 보기
              </Link>
              {!canEdit && <span className="panel__label">보기 전용이라 수정할 수 없어요</span>}
            </div>
          </section>

          <AskPanel
            projectId={projectId}
            manuscriptId={manuscriptId}
            chapter={chapter}
            textRef={textRef}
            beforeAsk={flush}
            onOpenCitation={(c) => goToChapter(c.chapter_no, c.quote)}
          />
        </div>
      )}
    </div>
  )
}

function SaveBadge({ state, fallbackAt, onRetry }: { state: SaveState | null; fallbackAt: string | null; onRetry: () => void }) {
  if (state?.kind === 'saving' || state?.kind === 'dirty') return <span className="badge badge--filled">저장 중…</span>
  if (state?.kind === 'error') {
    return (
      <button type="button" className="badge badge--error editor__retry" onClick={onRetry} title={state.message}>
        저장하지 못했어요 · 다시 시도
      </button>
    )
  }
  const at = state?.kind === 'saved' ? state.at : fallbackAt
  return <span className="badge badge--success">자동 저장됨{at ? ` · ${relativeTime(at)}` : ''}</span>
}

interface AskPanelProps {
  projectId: string
  manuscriptId: string
  chapter: Chapter | null
  textRef: RefObject<HTMLTextAreaElement | null>
  beforeAsk: () => Promise<void>
  onOpenCitation: (c: Citation) => void
}

/** 선택 문장에 질문하기 + 최근 답변 */
function AskPanel({ projectId, manuscriptId, chapter, textRef, beforeAsk, onOpenCitation }: AskPanelProps) {
  const { withAuth } = useSession()
  const [question, setQuestion] = useState('')
  const [selection, setSelection] = useState<{ chapterId: string; start: number; end: number; text: string } | null>(null)
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
      setSelection(end - start >= 2 ? { chapterId: chapter.chapter_id, start, end, text: el.value.slice(start, end) } : null)
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
    const q = question.trim()
    if (!q) {
      setError('질문을 입력해 주세요.')
      return
    }
    setSending(true)
    setError(null)
    try {
      await beforeAsk() // 선택 범위가 저장된 본문과 맞도록 먼저 저장
      const res = await withAuth((t) =>
        api.createThread(
          t,
          projectId,
          manuscriptId,
          selection
            ? { question: q, scope: 'selection', chapter_id: selection.chapterId, selection_range: { start: selection.start, end: selection.end } }
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
        <h2 className="panel__title">선택 문장에 질문하기</h2>
        {selection ? (
          <p className="editor__selection">
            <span className="panel__label">선택한 문장</span>“{selection.text.length > 60 ? `${selection.text.slice(0, 58)}…` : selection.text}”
            <button type="button" className="text-link" onClick={() => setSelection(null)}>
              선택 해제
            </button>
          </p>
        ) : (
          <p className="panel__label">본문에서 문장을 드래그하면 그 부분에 대해 물어볼 수 있어요. 선택하지 않으면 원고 전체를 두고 답해요.</p>
        )}
        <label className="field">
          <span className="field__label">질문</span>
          <textarea
            className="editor__question"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
            }}
            placeholder="윤서의 망설임을 더 선명하게 만들려면?"
            rows={3}
          />
        </label>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" block busy={sending}>
          {sending ? '보내는 중…' : '질문 보내기'}
        </Button>
      </form>

      <section className="panel" aria-labelledby="recent-answer">
        <div className="editor__answer-head">
          <h2 id="recent-answer" className="panel__title">
            최근 답변
          </h2>
          <Link className="text-link" to={`${projectPath(projectId, 'ask')}?manuscript=${manuscriptId}`}>
            대화 전체 보기
          </Link>
        </div>
        {target ? (
          <>
            <p className="editor__asked">Q. {target.question}</p>
            <AnswerCard
              message={answer.message}
              error={answer.error}
              onRetry={answer.retry}
              onOpenCitation={onOpenCitation}
              onEditQuestion={() => setQuestion(target.question)}
            />
          </>
        ) : (
          <div className="editor__empty">
            <p className="answer__title">아직 받은 답변이 없어요</p>
            <p className="answer__body">문장을 선택하고 질문하면 원고 근거와 함께 답변이 이곳에 표시돼요. 답변은 원고를 바꾸지 않아요.</p>
          </div>
        )}
      </section>
    </aside>
  )
}
