import type { QAMessage, QAThread } from '../../types'
import { requireProject } from '../access'
import { answerQuestion } from '../ai'
import type { MockDb, MockQAMessage, MockQAThread } from '../db'
import { fail, isResponse, nextId, noContent, ok, stamp, str, type Body, type MockRequest, type Route } from '../http'

const ANSWER_MS = 2500

/** 목업: 답변 생성 시간이 지난 메시지를 완료(또는 실패)로 바꾼다 */
function settle(db: MockDb) {
  for (const m of db.qaMessages) {
    if (m.status !== 'pending' || m.ready_at === null || m.ready_at > Date.now()) continue
    const thread = db.qaThreads.find((t) => t.thread_id === m.thread_id)
    const question = db.qaMessages.filter((x) => x.thread_id === m.thread_id && x.role === 'user' && x.created_at <= m.created_at).pop()
    if (!thread || !question) continue
    if (m.will_fail) {
      m.status = 'failed'
      m.will_fail = false
    } else {
      const chapters = db.chapters.filter((c) => c.manuscript_id === thread.manuscript_id)
      const answer = answerQuestion(question.content ?? '', chapters, thread.selected_text)
      m.status = 'completed'
      m.content = answer.content
      m.citations = answer.citations
    }
    m.ready_at = null
  }
}

function toMessage(m: MockQAMessage): QAMessage {
  return {
    message_id: m.message_id,
    thread_id: m.thread_id,
    role: m.role,
    content: m.content,
    status: m.status,
    citations: m.citations,
    error: m.status === 'failed' ? { code: 'AI_RESPONSE_TIMEOUT', message: '응답 시간이 너무 길어져 중단됐어요.' } : null,
    created_at: m.created_at,
  }
}

function toThread(db: MockDb, t: MockQAThread): QAThread {
  const messages = db.qaMessages.filter((m) => m.thread_id === t.thread_id)
  const chapters = [...new Set(messages.flatMap((m) => m.citations.map((c) => c.chapter_no)))].sort((a, b) => a - b)
  return {
    thread_id: t.thread_id,
    manuscript_id: t.manuscript_id,
    scope: t.scope,
    selection_range: t.selection_range,
    chapter_id: t.chapter_id,
    selected_text: t.selected_text,
    title: t.title,
    cited_chapters: chapters,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }
}

function addExchange(db: MockDb, thread: MockQAThread, question: string) {
  const t = stamp()
  const user: MockQAMessage = { message_id: nextId(db, 'msg'), thread_id: thread.thread_id, role: 'user', content: question, status: 'completed', citations: [], ready_at: null, will_fail: false, created_at: t }
  const assistant: MockQAMessage = {
    message_id: nextId(db, 'msg'),
    thread_id: thread.thread_id,
    role: 'assistant',
    content: null,
    status: 'pending',
    citations: [],
    ready_at: Date.now() + ANSWER_MS,
    // 목업: 질문에 "[실패]"를 넣으면 답변 실패(Figma 36)를 흉내 낸다
    will_fail: question.includes('[실패]'),
    created_at: t,
  }
  db.qaMessages.push(user, assistant)
  thread.updated_at = t
  return [user, assistant]
}

function findThread(req: MockRequest, db: MockDb, params: Record<string, string>) {
  const access = requireProject(req, db, params.projectId)
  if (isResponse(access)) return access
  settle(db)
  const thread = db.qaThreads.find((t) => t.thread_id === params.threadId && t.manuscript_id === params.manuscriptId)
  return thread ?? fail(404, 'QA_THREAD_NOT_FOUND', '질문 스레드를 찾을 수 없어요.')
}

const base = '/projects/:projectId/manuscripts/:manuscriptId/qa-threads'

// AIQ 명세
export const qaRoutes: Route[] = [
  [
    'GET',
    base,
    (req, db, { projectId, manuscriptId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      settle(db)
      const rows = db.qaThreads.filter((t) => t.manuscript_id === manuscriptId).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      return ok(200, rows.map((t) => toThread(db, t)), { next_cursor: null })
    },
  ],
  [
    'POST',
    base,
    (req, db, { projectId, manuscriptId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      const manuscript = db.manuscripts.find((m) => m.manuscript_id === manuscriptId && m.project_id === projectId)
      if (!manuscript) return fail(404, 'MANUSCRIPT_NOT_FOUND', '원고를 찾을 수 없어요.')
      const b = (req.body ?? {}) as Body
      const question = str(b.question)
      if (!question) return fail(400, 'INVALID_INPUT', '질문을 입력해 주세요.', { field: 'question' })
      const scope = b.scope === 'selection' ? 'selection' : 'whole'

      let selectedText: string | null = null
      let chapterId: string | null = null
      let range: { start: number; end: number } | null = null
      if (scope === 'selection') {
        const r = b.selection_range as { start?: number; end?: number } | undefined
        chapterId = str(b.chapter_id)
        const chapter = db.chapters.find((c) => c.chapter_id === chapterId && c.manuscript_id === manuscriptId)
        if (!chapter || !r || typeof r.start !== 'number' || typeof r.end !== 'number' || r.start < 0 || r.end <= r.start || r.end > chapter.content.length) {
          return fail(400, 'INVALID_SELECTION_RANGE', '선택한 범위를 찾을 수 없어요. 문장을 다시 선택해 주세요.')
        }
        range = { start: r.start, end: r.end }
        selectedText = chapter.content.slice(r.start, r.end)
      }

      const t = stamp()
      const thread: MockQAThread = {
        thread_id: nextId(db, 'qa'),
        project_id: projectId,
        manuscript_id: manuscriptId,
        scope,
        chapter_id: chapterId,
        selection_range: range,
        selected_text: selectedText,
        title: question.length > 24 ? `${question.slice(0, 22)}…` : question,
        created_at: t,
        updated_at: t,
      }
      db.qaThreads.push(thread)
      const messages = addExchange(db, thread, question)
      return ok(201, { thread: toThread(db, thread), messages: messages.map(toMessage) })
    },
  ],
  [
    'GET',
    `${base}/:threadId`,
    (req, db, params) => {
      const thread = findThread(req, db, params)
      if (isResponse(thread)) return thread
      const messages = db.qaMessages.filter((m) => m.thread_id === thread.thread_id)
      return ok(200, { thread: toThread(db, thread), messages: messages.map(toMessage) })
    },
  ],
  [
    'DELETE',
    `${base}/:threadId`,
    (req, db, params) => {
      const thread = findThread(req, db, params)
      if (isResponse(thread)) return thread
      db.qaThreads = db.qaThreads.filter((t) => t.thread_id !== thread.thread_id)
      db.qaMessages = db.qaMessages.filter((m) => m.thread_id !== thread.thread_id)
      return noContent()
    },
  ],
  [
    'POST',
    `${base}/:threadId/messages`,
    (req, db, params) => {
      const thread = findThread(req, db, params)
      if (isResponse(thread)) return thread
      const question = str((req.body as Body)?.content)
      if (!question) return fail(400, 'INVALID_INPUT', '질문을 입력해 주세요.', { field: 'content' })
      return ok(201, addExchange(db, thread, question).map(toMessage))
    },
  ],
  [
    'GET',
    `${base}/:threadId/messages/:messageId`,
    (req, db, params) => {
      const thread = findThread(req, db, params)
      if (isResponse(thread)) return thread
      const m = db.qaMessages.find((x) => x.thread_id === thread.thread_id && x.message_id === params.messageId)
      return m ? ok(200, toMessage(m), { retry_after_ms: m.status === 'pending' ? 1000 : null }) : fail(404, 'QA_MESSAGE_NOT_FOUND', '메시지를 찾을 수 없어요.')
    },
  ],
  [
    'POST',
    `${base}/:threadId/messages/:messageId/retry`,
    (req, db, params) => {
      const thread = findThread(req, db, params)
      if (isResponse(thread)) return thread
      const m = db.qaMessages.find((x) => x.thread_id === thread.thread_id && x.message_id === params.messageId)
      if (!m) return fail(404, 'QA_MESSAGE_NOT_FOUND', '메시지를 찾을 수 없어요.')
      if (m.status !== 'failed') return fail(409, 'INVALID_STATUS_TRANSITION', '실패한 답변만 다시 만들 수 있어요.')
      m.status = 'pending'
      m.ready_at = Date.now() + ANSWER_MS
      return ok(202, toMessage(m))
    },
  ],
]
