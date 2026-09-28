import { request, requestWithMeta } from './client'
import type { Chapter, Manuscript, ManuscriptSource, ManuscriptVersion, ManuscriptVersionDetail, QAMessage, QAThread } from './types'

// MSU 명세

const base = (projectId: string) => `/projects/${projectId}/manuscripts`

export function listManuscripts(accessToken: string, projectId: string) {
  return request<Manuscript[]>('GET', base(projectId), { accessToken, query: { limit: '100' } })
}

export function createManuscript(accessToken: string, projectId: string, input: { title: string; source_type: ManuscriptSource }) {
  return request<Manuscript>('POST', base(projectId), { body: input, accessToken })
}

export function getManuscript(accessToken: string, projectId: string, manuscriptId: string) {
  return request<Manuscript>('GET', `${base(projectId)}/${manuscriptId}`, { accessToken })
}

export function deleteManuscript(accessToken: string, projectId: string, manuscriptId: string) {
  return request<null>('DELETE', `${base(projectId)}/${manuscriptId}`, { accessToken })
}

/** 4.6 원고 파일 업로드 (multipart, 필드명 file) */
export function uploadManuscriptFile(accessToken: string, projectId: string, manuscriptId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<Manuscript>('POST', `${base(projectId)}/${manuscriptId}/file`, { body: form, accessToken })
}

export function listChapters(accessToken: string, projectId: string, manuscriptId: string) {
  return request<Chapter[]>('GET', `${base(projectId)}/${manuscriptId}/chapters`, { accessToken })
}

/** 4.7 장 추가 */
export function addChapter(accessToken: string, projectId: string, manuscriptId: string, input: { title?: string } = {}) {
  return request<Chapter>('POST', `${base(projectId)}/${manuscriptId}/chapters`, { body: input, accessToken })
}

/** 4.9 장 수정 — 편집기 자동 저장 */
export function saveChapter(accessToken: string, projectId: string, manuscriptId: string, chapterId: string, input: { content?: string; title?: string }) {
  return request<Chapter>('PATCH', `${base(projectId)}/${manuscriptId}/chapters/${chapterId}`, { body: input, accessToken })
}

/** 4.10 편집 이력 조회 (선택) — meta.total은 명세 미정의 */
export function listVersions(accessToken: string, projectId: string, manuscriptId: string, cursor?: string | null) {
  const query: Record<string, string> = { limit: '6' }
  if (cursor) query.cursor = cursor
  return requestWithMeta<ManuscriptVersion[], { next_cursor: string | null; total?: number }>('GET', `${base(projectId)}/${manuscriptId}/versions`, { accessToken, query })
}

/** (명세 미정의) 스냅샷 본문 */
export function getVersion(accessToken: string, projectId: string, manuscriptId: string, versionId: string) {
  return request<ManuscriptVersionDetail>('GET', `${base(projectId)}/${manuscriptId}/versions/${versionId}`, { accessToken })
}

// AIQ 명세 — 원고 단위 질문 스레드

const qa = (projectId: string, manuscriptId: string) => `${base(projectId)}/${manuscriptId}/qa-threads`

export interface AskInput {
  question: string
  scope: 'whole' | 'selection'
  chapter_id?: string
  selection_range?: { start: number; end: number }
}

export function listThreads(accessToken: string, projectId: string, manuscriptId: string) {
  return request<QAThread[]>('GET', qa(projectId, manuscriptId), { accessToken })
}

export function createThread(accessToken: string, projectId: string, manuscriptId: string, input: AskInput) {
  return request<{ thread: QAThread; messages: QAMessage[] }>('POST', qa(projectId, manuscriptId), { body: input, accessToken })
}

export function getThread(accessToken: string, projectId: string, manuscriptId: string, threadId: string) {
  return request<{ thread: QAThread; messages: QAMessage[] }>('GET', `${qa(projectId, manuscriptId)}/${threadId}`, { accessToken })
}

export function deleteThread(accessToken: string, projectId: string, manuscriptId: string, threadId: string) {
  return request<null>('DELETE', `${qa(projectId, manuscriptId)}/${threadId}`, { accessToken })
}

export function askFollowUp(accessToken: string, projectId: string, manuscriptId: string, threadId: string, content: string) {
  return request<QAMessage[]>('POST', `${qa(projectId, manuscriptId)}/${threadId}/messages`, { body: { content }, accessToken })
}

export function getMessage(accessToken: string, projectId: string, manuscriptId: string, threadId: string, messageId: string) {
  return request<QAMessage>('GET', `${qa(projectId, manuscriptId)}/${threadId}/messages/${messageId}`, { accessToken })
}

export function retryMessage(accessToken: string, projectId: string, manuscriptId: string, threadId: string, messageId: string) {
  return request<QAMessage>('POST', `${qa(projectId, manuscriptId)}/${threadId}/messages/${messageId}/retry`, { accessToken })
}
