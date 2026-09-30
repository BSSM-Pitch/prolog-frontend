import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as api from '../../api/manuscripts'
import type { Citation, QAMessage, QAThread } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { describeError } from '../../lib/errors'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import { AnswerCard } from './AnswerCard'
import { useAnswer } from './useAnswer'
import './AskPage.css'
import './answer.css'

const PAGE = 5

// Figma 842:579 · 02 AI 질문 / 1266:3062 · 35 답변 대기 / 1266:3230 · 36 답변 실패
export function AskPage() {
  const project = useProject()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const manuscripts = useResource(project ? (t) => api.listManuscripts(t, projectId) : null, [projectId])
  const ready = (manuscripts.data ?? []).filter((m) => m.status === 'ready')
  const manuscriptId = ready.find((m) => m.manuscript_id === params.get('manuscript'))?.manuscript_id ?? ready[0]?.manuscript_id ?? ''
  const manuscript = ready.find((m) => m.manuscript_id === manuscriptId)

  const threads = useResource(manuscriptId ? (t) => api.listThreads(t, projectId, manuscriptId) : null, [projectId, manuscriptId])
  const [shown, setShown] = useState(PAGE)
  const threadId = params.get('thread') ?? ''
  const [confirmDelete, setConfirmDelete] = useState<QAThread | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>

  const select = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  async function removeThread(t: QAThread) {
    setDeleting(true)
    try {
      await withAuth((token) => api.deleteThread(token, projectId, manuscriptId, t.thread_id))
      threads.setData((prev) => prev?.filter((x) => x.thread_id !== t.thread_id) ?? null)
      if (threadId === t.thread_id) select({ thread: null })
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const list = threads.data ?? []
  const current = list.find((t) => t.thread_id === threadId) ?? null

  return (
    <div className="ask">
      <header>
        <p className="page-crumb">AI 보조 도구 / 원고 질문</p>
        <h1 className="page-title">AI 질문</h1>
        <p className="page-desc">원고 범위를 지정하면 근거 장면과 함께 답변을 확인할 수 있습니다.</p>
      </header>

      {manuscripts.data && ready.length === 0 ? (
        <div className="panel">
          <p className="panel__title">질문할 원고가 없어요</p>
          <p className="page-desc">원고를 올리거나 편집기에서 쓴 뒤 질문할 수 있어요.</p>
          <Button onClick={() => navigate(projectPath(projectId, 'manuscripts'))}>원고 추가하기</Button>
        </div>
      ) : (
        <div className="ask__layout">
          <aside className="panel ask__threads" aria-labelledby="threads-title">
            <h2 id="threads-title" className="panel__title">
              최근 질문
            </h2>
            <Button tone="outline" block onClick={() => select({ thread: null })} aria-pressed={!threadId}>
              새 대화 시작
            </Button>
            {threads.loading && !threads.data && <p className="panel__label">불러오고 있어요</p>}
            {threads.data && list.length === 0 && <p className="panel__label">아직 질문이 없어요. 문장을 선택하거나 원고 전체를 두고 질문해 보세요.</p>}
            <ul className="thread-list">
              {list.slice(0, shown).map((t) => (
                <li key={t.thread_id}>
                  <button
                    type="button"
                    className="thread-item"
                    aria-current={t.thread_id === threadId || undefined}
                    onClick={() => select({ thread: t.thread_id })}
                  >
                    <span className="thread-item__title">{t.title}</span>
                    <span className="thread-item__meta">
                      {/* 백엔드 AIQ는 근거 장을 주지 않는다 — 없으면 범위만 보여 준다 */}
                      {[t.scope === 'selection' ? '선택 문장' : '원고 전체', ...t.cited_chapters.map((c) => `${c}장`)].join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="ask__thread-actions">
              {list.length > shown && (
                <Button tone="outline" onClick={() => setShown((n) => n + PAGE)}>
                  이전 대화 더 보기
                </Button>
              )}
              {current && (
                <Button tone="error" onClick={() => setConfirmDelete(current)}>
                  대화 삭제
                </Button>
              )}
            </div>
          </aside>

          <section className="panel ask__chat" aria-label="대화">
            <div className="ask__target">
              <label htmlFor="ask-manuscript" className="panel__label">
                대상 원고
              </label>
              <select
                id="ask-manuscript"
                value={manuscriptId}
                onChange={(e) => select({ manuscript: e.target.value, thread: null })}
                disabled={ready.length === 0}
              >
                {ready.map((m) => (
                  <option key={m.manuscript_id} value={m.manuscript_id}>
                    {project.title} / {m.title}
                  </option>
                ))}
              </select>
            </div>
            {manuscript && (
              <Conversation
                key={`${manuscriptId}/${threadId}`}
                projectId={projectId}
                manuscriptId={manuscriptId}
                thread={current}
                onThreadCreated={(t) => {
                  threads.setData((prev) => [t, ...(prev ?? [])])
                  select({ thread: t.thread_id })
                }}
                onAnswered={threads.reload}
                onOpenCitation={(c) =>
                  navigate(`${projectPath(projectId, `manuscripts/${manuscriptId}`)}?chapter=${c.chapter_no}`, { state: { highlight: c.quote } })
                }
              />
            )}
          </section>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="이 대화를 삭제할까요?"
          body="질문과 답변이 모두 사라지고 되돌릴 수 없어요. 원고에는 영향이 없어요."
          confirmLabel="삭제"
          busy={deleting}
          onConfirm={() => removeThread(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

interface ConversationProps {
  projectId: string
  manuscriptId: string
  thread: QAThread | null
  onThreadCreated: (t: QAThread) => void
  onAnswered: () => void
  onOpenCitation: (c: Citation) => void
}

function Conversation({ projectId, manuscriptId, thread, onThreadCreated, onAnswered, onOpenCitation }: ConversationProps) {
  const { withAuth } = useSession()
  const detail = useResource(thread ? (t) => api.getThread(t, projectId, manuscriptId, thread.thread_id) : null, [thread?.thread_id])
  const [extra, setExtra] = useState<QAMessage[]>([])
  const messages = [...(detail.data?.messages ?? []), ...extra]
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant') ?? null

  const polled = useAnswer(
    thread && lastAssistant ? { projectId, manuscriptId, threadId: thread.thread_id, messageId: lastAssistant.message_id } : null,
    lastAssistant,
  )
  // 폴링으로 받은 답변은 기억해 둔다 — 이어 묻기로 폴링 대상이 바뀌어도 앞 답변이 "찾는 중"으로 돌아가지 않게
  const [answered, setAnswered] = useState<Record<string, QAMessage>>({})
  // 폴링 중인 마지막 답변을 최신 값으로 바꿔 보여 준다
  const shownMessages = messages.map((m) => (polled.message && m.message_id === polled.message.message_id ? polled.message : (answered[m.message_id] ?? m)))
  const waiting = polled.message?.status === 'pending'

  useEffect(() => {
    const m = polled.message
    if (m && m.status !== 'pending') setAnswered((prev) => ({ ...prev, [m.message_id]: m }))
    if (m?.status === 'completed') onAnswered()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polled.message?.status])

  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [shownMessages.length, polled.message?.status])

  return (
    <>
      <div className="ask__messages">
        {!thread && (
          <div className="ask__empty">
            <p className="answer__title">원고에 대해 무엇이든 물어보세요</p>
            <p className="answer__body">답변에는 근거가 된 장과 문장이 함께 붙어요. 질문해도 원고는 바뀌지 않아요.</p>
          </div>
        )}
        {thread?.selected_text && (
          <p className="ask__scope">
            <span className="panel__label">선택한 문장</span>“{thread.selected_text}”
          </p>
        )}
        {thread && detail.loading && !detail.data && <p className="panel__label">대화를 불러오고 있어요</p>}
        {shownMessages.map((m) =>
          m.role === 'user' ? (
            <p key={m.message_id} className="bubble">
              {m.content}
            </p>
          ) : (
            <AnswerCard
              key={m.message_id}
              message={m}
              error={m.message_id === polled.message?.message_id ? polled.error : null}
              onRetry={polled.retry}
              onOpenCitation={onOpenCitation}
            />
          ),
        )}
        <div ref={bottom} />
      </div>

      <Composer
        projectId={projectId}
        manuscriptId={manuscriptId}
        thread={thread}
        disabled={waiting}
        onSent={async (q, scope) => {
          if (!thread) {
            const res = await withAuth((t) => api.createThread(t, projectId, manuscriptId, { question: q, ...scope }))
            onThreadCreated(res.thread)
            return
          }
          const sent = await withAuth((t) => api.askFollowUp(t, projectId, manuscriptId, thread.thread_id, q))
          setExtra((prev) => [...prev, ...sent])
          const assistant = sent.find((m) => m.role === 'assistant')
          if (assistant) polled.setMessage(assistant)
        }}
      />
    </>
  )
}

type Scope = { scope: 'whole' } | { scope: 'selection'; chapter_id: string; selection_range: { start: number; end: number } }

interface ComposerProps {
  projectId: string
  manuscriptId: string
  thread: QAThread | null
  disabled: boolean
  onSent: (question: string, scope: Scope) => Promise<void>
}

function Composer({ projectId, manuscriptId, thread, disabled, onSent }: ComposerProps) {
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<'whole' | 'selection'>('whole')
  const [chapterNo, setChapterNo] = useState<number | null>(null)
  const [range, setRange] = useState<{ start: number; end: number; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const chapters = useResource(mode === 'selection' ? (t) => api.listChapters(t, projectId, manuscriptId) : null, [projectId, manuscriptId, mode])
  const list = chapters.data ?? []
  const chapter = list.find((c) => c.chapter_no === chapterNo) ?? list[list.length - 1] ?? null
  // 후속 질문은 스레드의 범위를 그대로 따른다 (AIQ 명세: 범위는 스레드 단위)
  const followUp = thread !== null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q) return setError('질문을 입력해 주세요.')
    if (!followUp && mode === 'selection' && (!chapter || !range)) return setError('질문할 문장을 본문에서 드래그해 선택해 주세요.')
    setSending(true)
    setError(null)
    try {
      await onSent(q, !followUp && mode === 'selection' && chapter && range ? { scope: 'selection', chapter_id: chapter.chapter_id, selection_range: { start: range.start, end: range.end } } : { scope: 'whole' })
      setQuestion('')
      setRange(null)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <form className="composer" onSubmit={onSubmit} noValidate>
      <label className="field">
        <span className="field__label">질문</span>
        <textarea
          className="composer__input"
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
          }}
          rows={2}
          placeholder={followUp ? '이 답변에 이어 궁금한 점을 물어보세요' : '22장에서 윤서는 규칙 17을 이미 알고 있나요?'}
        />
      </label>

      {!followUp && mode === 'selection' && (
        <div className="composer__picker">
          <select value={chapter?.chapter_no ?? ''} onChange={(e) => (setChapterNo(Number(e.target.value)), setRange(null))} aria-label="장 선택">
            {list.map((c) => (
              <option key={c.chapter_id} value={c.chapter_no}>
                {c.chapter_no}장{c.title ? ` · ${c.title}` : ''}
              </option>
            ))}
          </select>
          <textarea
            readOnly
            className="composer__source"
            value={chapter?.content ?? ''}
            aria-label="질문할 문장을 드래그해 선택하세요"
            onSelect={(e) => {
              const el = e.currentTarget
              setRange(el.selectionEnd - el.selectionStart >= 2 ? { start: el.selectionStart, end: el.selectionEnd, text: el.value.slice(el.selectionStart, el.selectionEnd) } : null)
            }}
          />
          <p className="panel__label">{range ? `선택됨 · “${range.text.length > 50 ? `${range.text.slice(0, 48)}…` : range.text}”` : '위 본문에서 질문할 문장을 드래그해 선택하세요.'}</p>
        </div>
      )}

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="composer__actions">
        {followUp ? (
          <span className="panel__label">{thread.scope === 'selection' ? '범위 · 선택한 문장' : '범위 · 원고 전체'}</span>
        ) : (
          <div className="segmented" role="radiogroup" aria-label="질문 범위">
            {(['whole', 'selection'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>
                {m === 'whole' ? '전체 원고' : '문장 선택'}
              </button>
            ))}
          </div>
        )}
        <Button type="submit" busy={sending} disabled={disabled}>
          {sending ? '보내는 중…' : '보내기'}
        </Button>
      </div>
    </form>
  )
}
