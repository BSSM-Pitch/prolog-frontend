import { splitChapters } from '../lib/chapters'
import { joinChapters, toChapter, toManuscript, toVersion, type BackendChapter, type BackendManuscript, type BackendVersion } from './backendShapes'
import { ApiError, request, requestAll, requestWithMeta } from './client'
import { IS_REAL } from './config'
import type { Chapter, Manuscript, ManuscriptSource, ManuscriptVersion, ManuscriptVersionDetail, QAMessage, QAThread } from './types'

// MSU 명세

const base = (projectId: string) => `/projects/${projectId}/manuscripts`

export function listManuscripts(accessToken: string, projectId: string) {
  if (IS_REAL) return real.listManuscripts(accessToken, projectId)
  return request<Manuscript[]>('GET', base(projectId), { accessToken, query: { limit: '100' } })
}

export async function createManuscript(accessToken: string, projectId: string, input: { title: string; source_type: ManuscriptSource }) {
  if (!IS_REAL) return request<Manuscript>('POST', base(projectId), { body: input, accessToken })
  // 백엔드는 업로드 원고를 source_type "upload"로 부른다
  const m = await request<BackendManuscript>('POST', base(projectId), { body: { title: input.title, source_type: input.source_type === 'file' ? 'upload' : 'editor' }, accessToken })
  return toManuscript(m)
}

export function getManuscript(accessToken: string, projectId: string, manuscriptId: string) {
  if (IS_REAL) return real.getManuscript(accessToken, projectId, manuscriptId)
  return request<Manuscript>('GET', `${base(projectId)}/${manuscriptId}`, { accessToken })
}

export function deleteManuscript(accessToken: string, projectId: string, manuscriptId: string) {
  return request<null>('DELETE', `${base(projectId)}/${manuscriptId}`, { accessToken })
}

/** 4.6 원고 파일 업로드. 목업은 multipart, 백엔드는 presigned URL → 직접 PUT → 완료 알림 */
export function uploadManuscriptFile(accessToken: string, projectId: string, manuscriptId: string, file: File) {
  if (IS_REAL) return real.upload(accessToken, projectId, manuscriptId, file)
  const form = new FormData()
  form.append('file', file)
  return request<Manuscript>('POST', `${base(projectId)}/${manuscriptId}/file`, { body: form, accessToken })
}

export function listChapters(accessToken: string, projectId: string, manuscriptId: string) {
  if (IS_REAL) return real.listChapters(accessToken, projectId, manuscriptId)
  return request<Chapter[]>('GET', `${base(projectId)}/${manuscriptId}/chapters`, { accessToken })
}

/** 4.7 장 추가 */
export function addChapter(accessToken: string, projectId: string, manuscriptId: string, input: { title?: string } = {}) {
  if (IS_REAL) return real.addChapter(accessToken, projectId, manuscriptId, input)
  return request<Chapter>('POST', `${base(projectId)}/${manuscriptId}/chapters`, { body: input, accessToken })
}

/** 4.9 장 수정 — 편집기 자동 저장. 백엔드는 챕터가 프로젝트 직속 경로다 */
export async function saveChapter(accessToken: string, projectId: string, manuscriptId: string, chapterId: string, input: { content?: string; title?: string }) {
  if (!IS_REAL) return request<Chapter>('PATCH', `${base(projectId)}/${manuscriptId}/chapters/${chapterId}`, { body: input, accessToken })
  const saved = toChapter(await request<BackendChapter>('PATCH', `/projects/${projectId}/chapters/${chapterId}`, { body: input, accessToken }))
  real.syncContent(accessToken, projectId, manuscriptId)
  return saved
}

// --- real 모드 (prolog-backend MSU) ----------------------------------------------------------------

// 백엔드 app/content/manuscripts/storage.py _CONTENT_TYPES — presigned URL이 이 Content-Type으로 서명된다
const CONTENT_TYPES: Record<string, string> = {
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

/** 개발 중에는 s3mock 주소를 Vite 프록시(/__s3)로 바꿔 CORS를 피한다 */
function uploadUrlOf(url: string) {
  const u = new URL(url)
  return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? `/__s3${u.pathname}${u.search}` : url
}

/** 원고별로 진행 중인 장 나누기 — 동시에 두 번 나누지 않게 */
const splitting = new Map<string, Promise<Chapter[]>>()

const chaptersOf = (token: string, projectId: string, manuscriptId?: string) =>
  requestAll<BackendChapter>(`/projects/${projectId}/chapters`, { accessToken: token, query: manuscriptId ? { manuscript_id: manuscriptId } : undefined })

const manuscriptsOf = (token: string, projectId: string) => requestAll<BackendManuscript>(base(projectId), { accessToken: token })

/** 원고별 본문 동기화 예약 — 자동 저장이 이어지는 동안은 한 번만 보낸다 */
const SYNC_DELAY_MS = 1500
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>()

const real = {
  /**
   * 편집기는 장(PATCH chapters)을 저장하지만 백엔드 편집 이력은 원고 본문(PATCH manuscripts content)이
   * 바뀔 때 스냅샷을 남긴다. 장을 저장하면 잠시 뒤 장들을 이어 붙여 원고 본문도 저장한다.
   * 스냅샷을 합치는 기준(5분 · 1,000자)은 백엔드가 정한다.
   */
  syncContent(token: string, projectId: string, manuscriptId: string) {
    clearTimeout(syncTimers.get(manuscriptId))
    syncTimers.set(
      manuscriptId,
      setTimeout(() => {
        syncTimers.delete(manuscriptId)
        chaptersOf(token, projectId, manuscriptId)
          .then((chapters) => request<BackendManuscript>('PATCH', `${base(projectId)}/${manuscriptId}`, { body: { content: joinChapters(chapters) }, accessToken: token }))
          .catch(() => {
            // 이력만 늦어진다. 다음 저장 때 다시 보낸다
          })
      }, SYNC_DELAY_MS),
    )
  },

  async listManuscripts(token: string, projectId: string) {
    let [rows, chapters] = await Promise.all([manuscriptsOf(token, projectId), chaptersOf(token, projectId)])
    // 추출이 끝났는데 장이 없는 업로드 원고는 여기서 장으로 나눠 목록의 "N장"이 바로 맞게 한다
    const unsplit = rows.filter((m) => m.status === 'ready' && m.chapter_count === 0 && m.content?.trim())
    if (unsplit.length) {
      await Promise.all(unsplit.map((m) => real.listChapters(token, projectId, m.manuscript_id).catch(() => [])))
      ;[rows, chapters] = await Promise.all([manuscriptsOf(token, projectId), chaptersOf(token, projectId)])
    }
    // "82,420자" — 편집기 원고는 본문이 장에 있어 장 길이를 더한다
    const chars = new Map<string, number>()
    for (const c of chapters) chars.set(c.manuscript_id, (chars.get(c.manuscript_id) ?? 0) + c.content.length)
    return rows.map((m) => toManuscript(m, chars.get(m.manuscript_id)))
  },

  async getManuscript(token: string, projectId: string, manuscriptId: string) {
    const [m, chapters] = await Promise.all([
      request<BackendManuscript>('GET', `${base(projectId)}/${manuscriptId}`, { accessToken: token }),
      chaptersOf(token, projectId, manuscriptId),
    ])
    return toManuscript(m, chapters.length ? chapters.reduce((n, c) => n + c.content.length, 0) : undefined)
  },

  async upload(token: string, projectId: string, manuscriptId: string, file: File) {
    const format = file.name.split('.').pop()?.toLowerCase() ?? ''
    const issued = await request<{ upload_url: string }>('POST', `${base(projectId)}/${manuscriptId}/file`, { body: { file_format: format }, accessToken: token })
    const put = await fetch(uploadUrlOf(issued.upload_url), { method: 'PUT', headers: { 'Content-Type': CONTENT_TYPES[format] ?? 'application/octet-stream' }, body: file }).catch(() => null)
    if (!put?.ok) throw new ApiError(put?.status ?? 0, { code: 'UPLOAD_FAILED', message: '파일을 저장소에 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.', details: {} })
    return toManuscript(await request<BackendManuscript>('POST', `${base(projectId)}/${manuscriptId}/file/complete`, { accessToken: token }))
  },

  /**
   * 백엔드 추출 워커는 원고 본문(content)만 채우고 장을 만들지 않는다.
   * 장이 없는데 본문이 있으면 "1장" 같은 줄로 나눠 장을 만든다 (보기 전용이면 저장하지 않고 보여만 준다).
   * 같은 원고를 동시에 여러 번 불러도(StrictMode·여러 화면) 한 번만 나눈다.
   */
  async listChapters(token: string, projectId: string, manuscriptId: string): Promise<Chapter[]> {
    const rows = await chaptersOf(token, projectId, manuscriptId)
    if (rows.length) return rows.map(toChapter)
    let job = splitting.get(manuscriptId)
    if (!job) {
      job = real.splitIntoChapters(token, projectId, manuscriptId).finally(() => splitting.delete(manuscriptId))
      splitting.set(manuscriptId, job)
    }
    return job
  },

  async splitIntoChapters(token: string, projectId: string, manuscriptId: string): Promise<Chapter[]> {
    const m = await request<BackendManuscript>('GET', `${base(projectId)}/${manuscriptId}`, { accessToken: token })
    if (m.status !== 'ready' || !m.content?.trim()) return []
    const parts = splitChapters(m.content)
    try {
      for (const [i, p] of parts.entries()) {
        await request<BackendChapter>('POST', `/projects/${projectId}/chapters`, { body: { manuscript_id: manuscriptId, chapter_no: i + 1, title: p.title, content: p.content }, accessToken: token })
      }
    } catch {
      // 다른 탭이 먼저 나눴거나(장 번호 충돌) 권한이 없으면 아래에서 다시 확인한다
    }
    const rows = await chaptersOf(token, projectId, manuscriptId)
    if (rows.length) return rows.map(toChapter)
    // 보기 전용 등으로 만들지 못했으면 저장하지 않은 채 보여만 준다
    return parts.map((p, i) => ({ chapter_id: `preview-${i + 1}`, manuscript_id: manuscriptId, chapter_no: i + 1, title: p.title, content: p.content, updated_at: null }))
  },

  async addChapter(token: string, projectId: string, manuscriptId: string, input: { title?: string }) {
    const last = (await chaptersOf(token, projectId, manuscriptId)).reduce((max, c) => Math.max(max, c.chapter_no), 0)
    const no = last + 1
    const c = await request<BackendChapter>('POST', `/projects/${projectId}/chapters`, { body: { manuscript_id: manuscriptId, chapter_no: no, title: input.title || `${no}장`, content: '' }, accessToken: token })
    return toChapter(c)
  },
}

/** 백엔드 목록은 본문을 함께 준다. 본문 보기(getVersion)는 여기서 꺼낸다 */
const versionCache = new Map<string, ManuscriptVersionDetail>()

/** 4.10 편집 이력 조회 (선택) — meta.total은 명세 미정의(백엔드에는 없다) */
export async function listVersions(accessToken: string, projectId: string, manuscriptId: string, cursor?: string | null) {
  const query: Record<string, string> = { limit: '6' }
  if (cursor) query.cursor = cursor
  if (!IS_REAL) return requestWithMeta<ManuscriptVersion[], { next_cursor: string | null; total?: number }>('GET', `${base(projectId)}/${manuscriptId}/versions`, { accessToken, query })
  const res = await requestWithMeta<BackendVersion[], { next_cursor: string | null }>('GET', `${base(projectId)}/${manuscriptId}/versions`, { accessToken, query })
  const rows = res.data.map(toVersion)
  for (const v of rows) versionCache.set(v.version_id, v)
  return { data: rows as ManuscriptVersion[], meta: { next_cursor: res.meta.next_cursor, total: undefined as number | undefined } }
}

/** (명세 미정의) 스냅샷 본문. 백엔드에는 단건 조회가 없어 목록에서 받은 본문을 쓴다 */
export async function getVersion(accessToken: string, projectId: string, manuscriptId: string, versionId: string) {
  if (!IS_REAL) return request<ManuscriptVersionDetail>('GET', `${base(projectId)}/${manuscriptId}/versions/${versionId}`, { accessToken })
  const cached = versionCache.get(versionId)
  if (cached) return cached
  let cursor: string | null = null
  do {
    const page: Awaited<ReturnType<typeof listVersions>> = await listVersions(accessToken, projectId, manuscriptId, cursor)
    cursor = page.meta.next_cursor
  } while (!versionCache.has(versionId) && cursor)
  const found = versionCache.get(versionId)
  if (!found) throw new ApiError(404, { code: 'VERSION_NOT_FOUND', message: '스냅샷을 찾을 수 없어요.', details: {} })
  return found
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
