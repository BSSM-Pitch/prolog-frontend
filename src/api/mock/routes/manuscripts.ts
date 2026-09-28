import type { Chapter, Manuscript, ManuscriptVersion, ManuscriptVersionDetail } from '../../types'
import { requireProject, touchProject } from '../access'
import type { MockChapter, MockDb, MockManuscript, MockVersion } from '../db'
import { fail, isResponse, nextId, noContent, ok, paginate, stamp, str, type Body, type Route } from '../http'

const PROCESSING_MS = 3000
const MAX_FILE_BYTES = 20 * 1024 * 1024
const FORMATS = ['docx', 'txt', 'pdf']

/** 목업: 처리 시간이 지난 업로드를 완료(또는 실패)로 바꾼다 */
export function settleManuscripts(db: MockDb) {
  for (const m of db.manuscripts) {
    if (m.status === 'processing' && m.processing_until !== null && m.processing_until <= Date.now()) {
      m.status = m.fail_extraction ? 'extraction_failed' : 'ready'
      m.processing_until = null
      m.updated_at = stamp()
    }
  }
}

export function toManuscript(db: MockDb, m: MockManuscript): Manuscript {
  const chapters = db.chapters.filter((c) => c.manuscript_id === m.manuscript_id)
  return {
    manuscript_id: m.manuscript_id,
    project_id: m.project_id,
    title: m.title,
    source_type: m.source_type,
    file_name: m.file_name,
    file_format: m.file_format,
    file_size: m.file_size,
    chapter_count: m.status === 'ready' ? chapters.length : 0,
    char_count: m.status === 'ready' ? chapters.reduce((sum, c) => sum + c.content.length, 0) : 0,
    status: m.status,
    error:
      m.status === 'extraction_failed'
        ? { code: 'TEXT_EXTRACTION_FAILED', message: '파일에서 텍스트를 읽지 못했어요. 다시 시도하거나 다른 형식으로 올려 주세요.' }
        : null,
    created_at: m.created_at,
    updated_at: m.updated_at,
  }
}

function toChapter(c: MockChapter): Chapter {
  return { chapter_id: c.chapter_id, manuscript_id: c.manuscript_id, chapter_no: c.chapter_no, title: c.title, content: c.content, updated_at: c.updated_at }
}

/** "1장", "제 2 장", "Chapter 3" 같은 줄을 기준으로 본문을 장 단위로 나눈다 */
export function splitChapters(text: string): Array<{ title: string; content: string }> {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  // 한글 '장' 뒤에서는 \b(단어 경계)가 동작하지 않으므로 공백 또는 줄 끝으로 판단한다
  const heading = /^\s*(?:제\s*)?\d+\s*장(?:\s.*)?$|^\s*chapter\s+\d+(?:\s.*)?$/i
  const out: Array<{ title: string; content: string[] }> = []
  for (const line of lines) {
    if (heading.test(line)) out.push({ title: line.trim(), content: [] })
    else {
      if (out.length === 0) out.push({ title: '1장', content: [] })
      out[out.length - 1].content.push(line)
    }
  }
  return out.map((c) => ({ title: c.title, content: c.content.join('\n').trim() })).filter((c) => c.content || out.length === 1)
}

/** 같은 장을 이어서 고치는 동안에는 스냅샷 하나를 갱신하고, 이 시간이 지나면 새 스냅샷을 남긴다 */
const SNAPSHOT_GAP_MS = 10 * 60_000
const MAX_VERSIONS = 60

/** (명세 미정의) 편집 이력 스냅샷을 남긴다. 편집을 시작하면 "직접 수정", 오래 이어서 쓰면 "자동 저장" */
function recordVersion(db: MockDb, c: MockChapter, reason?: MockVersion['reason'], label: string | null = null) {
  const mine = db.versions.filter((v) => v.manuscript_id === c.manuscript_id)
  const last = mine.find((v) => v.chapter_id === c.chapter_id)
  const now = Date.now()
  const snap = { chapter_no: c.chapter_no, chapter_title: c.title, content: c.content }
  if (!reason) {
    const recent = last && (last.reason === 'edit' || last.reason === 'autosave') && mine[0] === last
    if (recent && now - new Date(last.created_at).getTime() < SNAPSHOT_GAP_MS) {
      Object.assign(last, snap)
      return
    }
    reason = recent ? 'autosave' : 'edit'
  }
  db.versions.unshift({ version_id: nextId(db, 'ver'), manuscript_id: c.manuscript_id, chapter_id: c.chapter_id, reason, label, ...snap, created_at: stamp() })
  // 저장소가 커지지 않도록 원고마다 오래된 스냅샷은 버린다
  const old = new Set(db.versions.filter((v) => v.manuscript_id === c.manuscript_id).slice(MAX_VERSIONS).map((v) => v.version_id))
  if (old.size) db.versions = db.versions.filter((v) => !old.has(v.version_id))
}

function toVersion(v: MockVersion): ManuscriptVersion {
  return {
    version_id: v.version_id,
    manuscript_id: v.manuscript_id,
    chapter_id: v.chapter_id,
    chapter_no: v.chapter_no,
    chapter_title: v.chapter_title,
    reason: v.reason,
    label: v.label,
    char_count: v.content.length,
    created_at: v.created_at,
  }
}

function findManuscript(db: MockDb, projectId: string, manuscriptId: string) {
  return db.manuscripts.find((m) => m.project_id === projectId && m.manuscript_id === manuscriptId)
}

// MSU 명세
export const manuscriptRoutes: Route[] = [
  [
    'GET',
    '/projects/:projectId/manuscripts',
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      settleManuscripts(db)
      const rows = db.manuscripts.filter((m) => m.project_id === projectId).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      const { page, next_cursor } = paginate(req, rows)
      return ok(200, page.map((m) => toManuscript(db, m)), { next_cursor })
    },
  ],
  [
    'POST',
    '/projects/:projectId/manuscripts',
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const b = (req.body ?? {}) as Body
      const title = str(b.title) || '새 원고'
      const sourceType = b.source_type
      if (sourceType !== 'file' && sourceType !== 'editor') return fail(400, 'INVALID_INPUT', 'source_type은 file 또는 editor여야 해요.')
      const t = stamp()
      const m: MockManuscript = {
        manuscript_id: nextId(db, 'ms'),
        project_id: projectId,
        title,
        source_type: sourceType,
        file_name: null,
        file_format: null,
        file_size: null,
        status: 'ready',
        processing_until: null,
        fail_extraction: false,
        created_at: t,
        updated_at: t,
      }
      db.manuscripts.push(m)
      // 에디터 원고는 빈 1장으로 시작한다
      if (sourceType === 'editor') {
        db.chapters.push({ chapter_id: `${m.manuscript_id}_ch1`, manuscript_id: m.manuscript_id, chapter_no: 1, title: '1장', content: '', updated_at: t })
      }
      touchProject(db, projectId)
      return ok(201, toManuscript(db, m))
    },
  ],
  [
    'GET',
    '/projects/:projectId/manuscripts/:manuscriptId',
    (req, db, { projectId, manuscriptId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      settleManuscripts(db)
      const m = findManuscript(db, projectId, manuscriptId)
      return m ? ok(200, toManuscript(db, m)) : fail(404, 'MANUSCRIPT_NOT_FOUND', '원고를 찾을 수 없어요.')
    },
  ],
  [
    'PATCH',
    '/projects/:projectId/manuscripts/:manuscriptId',
    (req, db, { projectId, manuscriptId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const m = findManuscript(db, projectId, manuscriptId)
      if (!m) return fail(404, 'MANUSCRIPT_NOT_FOUND', '원고를 찾을 수 없어요.')
      const b = (req.body ?? {}) as Body
      if (b.source_type !== undefined && b.source_type !== m.source_type) {
        return fail(409, 'SOURCE_TYPE_IMMUTABLE', '원고를 만든 뒤에는 작성 방식을 바꿀 수 없어요.')
      }
      if (b.title !== undefined) {
        const title = str(b.title)
        if (!title) return fail(400, 'INVALID_INPUT', '원고 제목을 입력해 주세요.', { field: 'title' })
        m.title = title
      }
      m.updated_at = stamp()
      touchProject(db, projectId)
      return ok(200, toManuscript(db, m))
    },
  ],
  [
    'DELETE',
    '/projects/:projectId/manuscripts/:manuscriptId',
    (req, db, { projectId, manuscriptId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      if (!findManuscript(db, projectId, manuscriptId)) return fail(404, 'MANUSCRIPT_NOT_FOUND', '원고를 찾을 수 없어요.')
      db.manuscripts = db.manuscripts.filter((m) => m.manuscript_id !== manuscriptId)
      db.chapters = db.chapters.filter((c) => c.manuscript_id !== manuscriptId)
      touchProject(db, projectId)
      return noContent()
    },
  ],
  [
    // 4.6 원고 파일 업로드 (multipart/form-data, 필드명 file)
    'POST',
    '/projects/:projectId/manuscripts/:manuscriptId/file',
    async (req, db, { projectId, manuscriptId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const m = findManuscript(db, projectId, manuscriptId)
      if (!m) return fail(404, 'MANUSCRIPT_NOT_FOUND', '원고를 찾을 수 없어요.')
      if (m.source_type !== 'file') return fail(409, 'SOURCE_TYPE_IMMUTABLE', '편집기로 만든 원고에는 파일을 올릴 수 없어요.')

      const file = req.body instanceof FormData ? req.body.get('file') : null
      if (!(file instanceof File)) return fail(400, 'INVALID_INPUT', '파일을 선택해 주세요.')
      const format = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!FORMATS.includes(format)) return fail(400, 'UNSUPPORTED_FILE_FORMAT', 'DOCX · TXT · PDF 파일만 올릴 수 있어요.', { format })
      if (file.size > MAX_FILE_BYTES) return fail(413, 'FILE_TOO_LARGE', '20MB 이하 파일만 올릴 수 있어요.', { size: file.size })

      // txt는 실제 본문을 쓰고, docx·pdf는 목업이라 추출된 척한다
      const text = format === 'txt' ? await file.text() : `(목업) ${file.name}에서 추출한 본문입니다.\n실제 서버에서는 파일 내용이 이곳에 들어갑니다.`
      const parts = splitChapters(text)
      const t = stamp()
      db.chapters = db.chapters.filter((c) => c.manuscript_id !== m.manuscript_id)
      parts.forEach((p, i) =>
        db.chapters.push({ chapter_id: `${m.manuscript_id}_ch${i + 1}`, manuscript_id: m.manuscript_id, chapter_no: i + 1, title: p.title, content: p.content, updated_at: t }),
      )
      const first = db.chapters.find((c) => c.manuscript_id === m.manuscript_id && c.chapter_no === 1)
      if (first) recordVersion(db, first, 'file_upload', `${m.title} 불러옴`)
      Object.assign(m, {
        file_name: file.name,
        file_format: format,
        file_size: file.size,
        status: 'processing',
        processing_until: Date.now() + PROCESSING_MS,
        // 목업: 파일 이름에 "실패"나 "fail"이 들어가면 추출 실패를 흉내 낸다 (Figma 18 화면의 실패 상태 시연용)
        fail_extraction: /실패|fail/i.test(file.name),
        updated_at: t,
      })
      touchProject(db, projectId)
      return ok(202, toManuscript(db, m))
    },
  ],
  [
    'GET',
    '/projects/:projectId/manuscripts/:manuscriptId/chapters',
    (req, db, { projectId, manuscriptId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      settleManuscripts(db)
      const m = findManuscript(db, projectId, manuscriptId)
      if (!m) return fail(404, 'MANUSCRIPT_NOT_FOUND', '원고를 찾을 수 없어요.')
      if (m.status !== 'ready') return ok(200, [], { next_cursor: null })
      const rows = db.chapters.filter((c) => c.manuscript_id === manuscriptId).sort((a, b) => a.chapter_no - b.chapter_no)
      return ok(200, rows.map(toChapter), { next_cursor: null })
    },
  ],
  [
    // 4.7 챕터 추가 (편집기)
    'POST',
    '/projects/:projectId/manuscripts/:manuscriptId/chapters',
    (req, db, { projectId, manuscriptId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const m = findManuscript(db, projectId, manuscriptId)
      if (!m) return fail(404, 'MANUSCRIPT_NOT_FOUND', '원고를 찾을 수 없어요.')
      const b = (req.body ?? {}) as Body
      const last = db.chapters.filter((c) => c.manuscript_id === manuscriptId).reduce((max, c) => Math.max(max, c.chapter_no), 0)
      const no = last + 1
      const t = stamp()
      const chapter: MockChapter = {
        chapter_id: `${manuscriptId}_ch${no}_${db.seq++}`,
        manuscript_id: manuscriptId,
        chapter_no: no,
        title: str(b.title) || `${no}장`,
        content: typeof b.content === 'string' ? b.content : '',
        updated_at: t,
      }
      db.chapters.push(chapter)
      m.updated_at = t
      touchProject(db, projectId)
      return ok(201, toChapter(chapter))
    },
  ],
  [
    // 4.9 챕터 수정 — 편집기 자동 저장
    'PATCH',
    '/projects/:projectId/manuscripts/:manuscriptId/chapters/:chapterId',
    (req, db, { projectId, manuscriptId, chapterId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const m = findManuscript(db, projectId, manuscriptId)
      const c = db.chapters.find((x) => x.manuscript_id === manuscriptId && x.chapter_id === chapterId)
      if (!m || !c) return fail(404, 'CHAPTER_NOT_FOUND', '장을 찾을 수 없어요.')
      const b = (req.body ?? {}) as Body
      const changed = typeof b.content === 'string' && b.content !== c.content
      if (typeof b.content === 'string') c.content = b.content
      if (b.title !== undefined) c.title = str(b.title) || c.title
      const t = stamp()
      c.updated_at = t
      m.updated_at = t
      if (changed) recordVersion(db, c)
      touchProject(db, projectId)
      return ok(200, toChapter(c))
    },
  ],
  [
    // 4.10 편집 이력 조회 (선택) — 자동 저장 스냅샷 목록. 필드는 명세 미정의
    'GET',
    '/projects/:projectId/manuscripts/:manuscriptId/versions',
    (req, db, { projectId, manuscriptId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      if (!findManuscript(db, projectId, manuscriptId)) return fail(404, 'MANUSCRIPT_NOT_FOUND', '원고를 찾을 수 없어요.')
      const rows = db.versions.filter((v) => v.manuscript_id === manuscriptId).sort((a, b) => b.created_at.localeCompare(a.created_at))
      const { page, next_cursor } = paginate(req, rows)
      return ok(200, page.map(toVersion), { next_cursor, total: rows.length })
    },
  ],
  [
    // (명세 미정의) 스냅샷 본문 조회
    'GET',
    '/projects/:projectId/manuscripts/:manuscriptId/versions/:versionId',
    (req, db, { projectId, manuscriptId, versionId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      const v = db.versions.find((x) => x.manuscript_id === manuscriptId && x.version_id === versionId)
      if (!v || !findManuscript(db, projectId, manuscriptId)) return fail(404, 'VERSION_NOT_FOUND', '스냅샷을 찾을 수 없어요.')
      const detail: ManuscriptVersionDetail = { ...toVersion(v), content: v.content }
      return ok(200, detail)
    },
  ],
]
