import { codesByCreation, type BackendChapter, type BackendCharacter, type BackendWorldRule } from './backendShapes'
import { ApiError, request, requestAll, requestLenient } from './client'
import { listChapters, listManuscripts, saveChapter, syncManuscriptContent } from './manuscripts'
import type { Conflict, ConflictCheck, RuleExtraction, WorldRule } from './types'

// real 모드 AI — prolog-backend 06b8928의 REX 추출과 SCDS를 화면 모양으로 맞춘다.
//
// REX: 규칙 후보는 추출 작업 결과 안에만 있고 "추출 목록" API가 없다. 이 브라우저에서 요청한 추출 ID를 기억해 두고
//   목록을 부를 때 그 결과의 후보를 확정 규칙 뒤에 붙인다. 후보 ID는 "추출ID~번호"다.
// SCDS: 백엔드는 "사건 저장 → 그 사건만 검사"다. 프로젝트 전체 재검사가 없어, 원고의 장 본문을 사건으로 저장해
//   검사 여러 개를 만들고 하나의 작업처럼 묶어 보여 준다.

const p = (projectId: string) => `/projects/${projectId}`

// --- 저장소 (이 브라우저) -------------------------------------------------------------------------

function readStore<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, T>
  } catch {
    return {}
  }
}

function writeStore<T>(key: string, store: Record<string, T>) {
  try {
    localStorage.setItem(key, JSON.stringify(store))
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 기억한다
  }
}

const EXTRACTIONS = 'prolog.rule-extractions.v1'
type RememberedExtraction = { extraction_id: string; manuscript_id: string }

const remembered = (projectId: string) => readStore<RememberedExtraction[]>(EXTRACTIONS)[projectId] ?? []

function remember(projectId: string, e: RememberedExtraction) {
  const store = readStore<RememberedExtraction[]>(EXTRACTIONS)
  store[projectId] = [e, ...(store[projectId] ?? []).filter((x) => x.extraction_id !== e.extraction_id)].slice(0, 20)
  writeStore(EXTRACTIONS, store)
}

function forget(projectId: string, extractionId: string) {
  const store = readStore<RememberedExtraction[]>(EXTRACTIONS)
  store[projectId] = (store[projectId] ?? []).filter((x) => x.extraction_id !== extractionId)
  writeStore(EXTRACTIONS, store)
}

// --- REX ----------------------------------------------------------------------------------------

interface BackendCandidate {
  index: number
  title: string
  description: string
  violation_keywords: string[]
  evidence: string | null
  source_chapter: number | null
  review_status: 'pending' | 'confirmed' | 'ignored'
  rule_id: string | null
}

interface BackendRuleExtraction {
  extraction_id: string
  manuscript_id: string
  status: 'queued' | 'extracting' | 'completed' | 'failed'
  extracted_rules: BackendCandidate[]
  created_at: string
}

type CandidateEdit = { title?: string; description?: string; violation_keywords?: string[] }

const candidateId = (extractionId: string, index: number) => `${extractionId}~${index}`
export const isCandidateId = (id: string) => id.includes('~')
const parseCandidate = (id: string) => {
  const [extractionId, index] = id.split('~')
  return { extractionId, index: Number(index) }
}

/** 확정 전 후보를 고친 내용 — 확정할 때 edits로 함께 보낸다 */
const candidateEdits = new Map<string, CandidateEdit>()

const extractionPath = (projectId: string, manuscriptId: string, extractionId = '') =>
  `${p(projectId)}/manuscripts/${manuscriptId}/rule-extractions${extractionId ? `/${extractionId}` : ''}`

const toRuleJob = (e: BackendRuleExtraction): RuleExtraction => ({
  job_id: e.extraction_id,
  status: e.status === 'extracting' ? 'analyzing' : e.status,
  result_ids: (e.extracted_rules ?? []).filter((c) => c.review_status === 'pending').map((c) => candidateId(e.extraction_id, c.index)),
  skipped_reason: null,
  manuscript_id: e.manuscript_id,
})

async function fetchExtraction(token: string, projectId: string, r: RememberedExtraction) {
  try {
    return (await requestLenient<BackendRuleExtraction>('GET', extractionPath(projectId, r.manuscript_id, r.extraction_id), { accessToken: token })).data
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) forget(projectId, r.extraction_id)
    return null
  }
}

export async function extractRules(token: string, projectId: string, manuscriptId: string) {
  await syncManuscriptContent(token, projectId, manuscriptId)
  const e = (await requestLenient<BackendRuleExtraction>('POST', extractionPath(projectId, manuscriptId), { accessToken: token })).data
  remember(projectId, { extraction_id: e.extraction_id, manuscript_id: e.manuscript_id })
  return toRuleJob(e)
}

export async function getRuleExtraction(token: string, projectId: string, manuscriptId: string, jobId: string) {
  return toRuleJob((await requestLenient<BackendRuleExtraction>('GET', extractionPath(projectId, manuscriptId, jobId), { accessToken: token })).data)
}

export async function listRules(token: string, projectId: string): Promise<WorldRule[]> {
  const [rules, extractions] = await Promise.all([
    requestAll<BackendWorldRule>(`${p(projectId)}/world-rules`, { accessToken: token }),
    Promise.all(remembered(projectId).map((r) => fetchExtraction(token, projectId, r))),
  ])
  // 백엔드 후보는 근거 장(source_chapter)을 비워 둔다. 근거 문장이 들어 있는 장을 찾아 채운다
  const manuscriptIds = [...new Set(extractions.flatMap((e) => (e?.status === 'completed' && e.extracted_rules.length ? [e.manuscript_id] : [])))]
  const chapterLists = new Map(await Promise.all(manuscriptIds.map(async (id) => [id, await listChapters(token, projectId, id).catch(() => [])] as const)))
  const squash = (t: string) => t.replace(/\s+/g, '')
  const chapterOf = (manuscriptId: string, evidence: string | null) =>
    evidence ? (chapterLists.get(manuscriptId)?.find((c) => squash(c.content).includes(squash(evidence)))?.chapter_no ?? null) : null

  const codes = codesByCreation(rules, (r) => r.rule_id, 'R')
  const confirmed = rules.map(
    (r): WorldRule => ({
      rule_id: r.rule_id,
      code: codes.get(r.rule_id)!,
      title: r.title,
      description: r.description,
      violation_keywords: r.violation_keywords,
      origin: r.origin,
      status: 'confirmed',
      source_chapter: r.source_chapter_no,
      evidence: r.evidence,
    }),
  )
  // 확정한 후보는 백엔드 규칙 목록에 이미 있다. 남은 후보(검토 대기·무시)만 번호를 이어 붙인다
  const candidates = extractions
    .flatMap((e) => (e?.status === 'completed' ? e.extracted_rules.filter((c) => c.review_status !== 'confirmed').map((c) => ({ e, c })) : []))
    .map(({ e, c }, i): WorldRule => {
      const id = candidateId(e.extraction_id, c.index)
      const edit = candidateEdits.get(id) ?? {}
      return {
        rule_id: id,
        code: `R${String(rules.length + i + 1).padStart(2, '0')}`,
        title: edit.title ?? c.title,
        description: edit.description ?? c.description,
        violation_keywords: edit.violation_keywords ?? c.violation_keywords,
        origin: 'ai_extracted',
        status: c.review_status === 'ignored' ? 'ignored' : 'pending',
        source_chapter: c.source_chapter ?? chapterOf(e.manuscript_id, c.evidence),
        evidence: c.evidence,
      }
    })
  return [...confirmed, ...candidates]
}

async function reviewCandidate(token: string, projectId: string, id: string, body: { selected_indices?: number[]; ignored_indices?: number[]; edits?: Record<string, CandidateEdit> }) {
  const { extractionId, index } = parseCandidate(id)
  const found = remembered(projectId).find((r) => r.extraction_id === extractionId)
  if (!found) throw new ApiError(404, { code: 'EXTRACTION_NOT_FOUND', message: '규칙 후보를 찾을 수 없어요. 규칙을 다시 추출해 주세요.', details: { index } })
  return request<BackendWorldRule[]>('POST', `${extractionPath(projectId, found.manuscript_id, extractionId)}/confirm`, { body, accessToken: token })
}

/** 후보를 고치면 확정 전까지 이 화면에서 들고 있다가 확정할 때 보낸다 */
export function editCandidate(id: string, input: CandidateEdit) {
  const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== '')) as CandidateEdit
  candidateEdits.set(id, { ...candidateEdits.get(id), ...clean })
}

export async function confirmCandidate(token: string, projectId: string, id: string) {
  const { index } = parseCandidate(id)
  const edit = candidateEdits.get(id)
  const created = await reviewCandidate(token, projectId, id, { selected_indices: [index], edits: edit ? { [index]: edit } : {} })
  candidateEdits.delete(id)
  return created[0]?.rule_id ?? null
}

export async function ignoreCandidate(token: string, projectId: string, id: string) {
  await reviewCandidate(token, projectId, id, { ignored_indices: [parseCandidate(id).index] })
}

// --- SCDS ---------------------------------------------------------------------------------------

interface BackendCheck {
  check_id: string
  event_id: string
  status: ConflictCheck['status']
  rule_result: { has_candidate: boolean; skipped: boolean; skipped_reason: string | null; candidates: unknown[] }
  conflict_ids: string[]
}

interface BackendConflict {
  conflict_id: string
  check_id: string | null
  character_id: string | null
  rule_id: string | null
  chapter_id: string | null
  chapter: number | null
  conflict_target: string | null
  matched_keyword: string | null
  input_event: string
  detected_by: 'rule' | 'ai'
  severity: Conflict['severity'] | null
  advice: string | null
  status: Conflict['status']
  modified_content: string | null
  created_at: string
  resolved_at: string | null
}

const RUNNING = ['queued', 'analyzing']
/** 재검사 한 번 = 백엔드 검사 여러 개 */
const scans = new Map<string, BackendCheck[]>()
let scanSeq = 0

/** 사건 본문은 5,000자까지다. 문단 경계로 자른다 */
function chunks(text: string, max = 5000) {
  const out: string[] = []
  let cur = ''
  for (const para of text.split(/\n+/).map((s) => s.trim()).filter(Boolean)) {
    for (let piece = para; piece; piece = piece.slice(max)) {
      const part = piece.slice(0, max)
      if (cur && cur.length + 1 + part.length > max) (out.push(cur), (cur = ''))
      cur = cur ? `${cur}\n${part}` : part
    }
  }
  if (cur) out.push(cur)
  return out
}

/** 같은 규칙·인물로 이미 검사한 본문은 다시 사건으로 만들지 않는다 (중복 충돌 방지) */
const SCANNED = 'prolog.scanned-chunks.v1'
function hash(s: string) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function aggregate(jobId: string, checks: BackendCheck[], manuscriptId: string | null): ConflictCheck {
  const statuses = checks.map((c) => c.status)
  const result_ids = checks.flatMap((c) => c.conflict_ids)
  const base = { job_id: jobId, result_ids, manuscript_id: manuscriptId, skipped_reason: null }
  if (statuses.some((s) => RUNNING.includes(s))) return { ...base, status: statuses.includes('analyzing') ? 'analyzing' : 'queued' }
  if (statuses.includes('failed')) return { ...base, status: 'failed' }
  const skipped = checks.find((c) => c.rule_result.skipped)
  if (checks.length && checks.every((c) => c.status === 'skipped' && c.rule_result.skipped)) return { ...base, status: 'skipped', skipped_reason: skipped?.rule_result.skipped_reason ?? null }
  return { ...base, status: 'completed' }
}

const scanManuscript = new Map<string, string | null>()

export async function rescan(token: string, projectId: string): Promise<ConflictCheck> {
  const jobId = `scan-${++scanSeq}`
  const [manuscripts, characters, rules] = await Promise.all([
    listManuscripts(token, projectId),
    requestAll<BackendCharacter>(`${p(projectId)}/characters`, { accessToken: token }),
    requestAll<BackendWorldRule>(`${p(projectId)}/world-rules`, { accessToken: token }),
  ])
  const latest = manuscripts.filter((m) => m.status === 'ready')[0] ?? null
  scanManuscript.set(jobId, latest?.manuscript_id ?? null)
  if (!latest || !characters.length || !rules.length) {
    scans.set(jobId, [])
    return { job_id: jobId, status: 'skipped', result_ids: [], skipped_reason: !characters.length ? 'NO_CHARACTERS' : 'NO_RULES', manuscript_id: latest?.manuscript_id ?? null }
  }
  // 사건 참여 인물은 본문에 이름이 나오는 인물로 한다. 아무도 안 나오면 첫 인물(주인공)로 본다.
  // 전원을 넣으면 같은 문장이 인물 수만큼 충돌로 겹친다
  const participants = (content: string) => {
    const named = characters.filter((c) => content.includes(c.name)).slice(0, 50)
    return (named.length ? named : characters.slice(0, 1)).map((c) => c.character_id)
  }
  const context = hash(JSON.stringify([characters.map((c) => c.character_id), rules.map((r) => [r.rule_id, r.updated_at])]))
  const store = readStore<string[]>(SCANNED)
  const seen = new Set(store[projectId] ?? [])

  const checks: BackendCheck[] = []
  for (const chapter of await listChapters(token, projectId, latest.manuscript_id)) {
    for (const content of chunks(chapter.content)) {
      const key = `${chapter.chapter_id}:${context}:${hash(content)}`
      if (seen.has(key)) continue
      const created = await request<{ conflict_check: BackendCheck }>('POST', `${p(projectId)}/chapters/${chapter.chapter_id}/events`, { body: { character_ids: participants(content), content }, accessToken: token })
      checks.push(created.conflict_check)
      seen.add(key)
    }
  }
  store[projectId] = [...seen].slice(-500)
  writeStore(SCANNED, store)
  scans.set(jobId, checks)
  return aggregate(jobId, checks, latest.manuscript_id)
}

async function refresh(token: string, projectId: string, jobId: string, retry: boolean) {
  const checks = scans.get(jobId) ?? []
  const next = await Promise.all(
    checks.map(async (c) => {
      if (retry && c.status === 'failed') return (await requestLenient<BackendCheck>('POST', `${p(projectId)}/conflict-checks/${c.check_id}/retry`, { accessToken: token })).data
      if (!retry && RUNNING.includes(c.status)) return (await requestLenient<BackendCheck>('GET', `${p(projectId)}/conflict-checks/${c.check_id}`, { accessToken: token })).data
      return c
    }),
  )
  scans.set(jobId, next)
  return aggregate(jobId, next, scanManuscript.get(jobId) ?? null)
}

export const getConflictCheck = (token: string, projectId: string, jobId: string) => refresh(token, projectId, jobId, false)
export const retryConflictCheck = (token: string, projectId: string, jobId: string) => refresh(token, projectId, jobId, true)

/** 사건 본문에서 걸린 표현이 있는 문장만 보여 준다 */
function sentenceOf(text: string, keyword: string | null) {
  const sentences = text.split(/(?<=[.!?。…"”'’])\s+|\n+/).map((s) => s.trim()).filter(Boolean)
  const hit = keyword ? sentences.find((s) => s.includes(keyword)) : undefined
  return hit ?? (sentences[0] ?? text).slice(0, 200)
}

async function realConflicts(token: string, projectId: string) {
  const [rows, rules, characters] = await Promise.all([
    requestAll<BackendConflict>(`${p(projectId)}/conflicts`, { accessToken: token }),
    requestAll<BackendWorldRule>(`${p(projectId)}/world-rules`, { accessToken: token }),
    requestAll<BackendCharacter>(`${p(projectId)}/characters`, { accessToken: token }),
  ])
  const ruleOf = new Map(rules.map((r) => [r.rule_id, r]))
  const nameOf = new Map(characters.map((c) => [c.character_id, c.name]))
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.conflict_id.localeCompare(b.conflict_id))
  return ordered.map((c, i) => {
    const rule = c.rule_id ? ruleOf.get(c.rule_id) : undefined
    const conflict: Conflict = {
      conflict_id: c.conflict_id,
      index: i + 1,
      title: rule?.title ?? c.conflict_target ?? c.matched_keyword ?? '설정 충돌',
      severity: c.severity ?? 'medium',
      status: c.status,
      rule_id: c.rule_id,
      evidence: [
        { chapter: rule?.source_chapter_no ?? 0, character: null, quote: rule?.evidence ?? rule?.description ?? '' },
        { chapter: c.chapter ?? 0, character: c.character_id ? (nameOf.get(c.character_id) ?? null) : null, quote: sentenceOf(c.input_event, c.matched_keyword) },
      ],
      advice:
        c.advice ??
        `규칙 검사에서 "${c.matched_keyword ?? c.conflict_target ?? ''}" 표현이 "${rule?.title ?? '설정 규칙'}"과 부딪힐 수 있어 표시했어요. AI 조언은 받지 못했어요.`,
      modified_content: c.modified_content,
      resolved_at: c.resolved_at,
    }
    return { conflict, chapterId: c.chapter_id }
  })
}

export async function listConflicts(token: string, projectId: string) {
  return (await realConflicts(token, projectId)).map((x) => x.conflict)
}

/** SCDS 4.11 — 직접 수정은 백엔드에 고친 문장을 남기고, 원고의 그 문장도 바꿔 저장한다 */
export async function resolveConflict(token: string, projectId: string, conflictId: string, body: { action: 'accepted' | 'ignored' | 'modified'; modified_content?: string }) {
  const before = (await realConflicts(token, projectId)).find((x) => x.conflict.conflict_id === conflictId)
  await request<BackendConflict>('PATCH', `${p(projectId)}/conflicts/${conflictId}`, { body, accessToken: token })
  if (body.action === 'modified' && body.modified_content && before?.chapterId) {
    const quote = before.conflict.evidence[before.conflict.evidence.length - 1].quote
    const chapter = await request<BackendChapter>('GET', `${p(projectId)}/chapters/${before.chapterId}`, { accessToken: token })
    if (quote && chapter.content.includes(quote)) await saveChapter(token, projectId, chapter.manuscript_id, chapter.chapter_id, { content: chapter.content.replace(quote, body.modified_content) })
  }
  const after = (await listConflicts(token, projectId)).find((c) => c.conflict_id === conflictId)
  if (!after) throw new ApiError(404, { code: 'CONFLICT_NOT_FOUND', message: '충돌을 찾을 수 없어요.', details: {} })
  return after
}
