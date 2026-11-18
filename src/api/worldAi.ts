import { codesByCreation, type BackendCharacter, type BackendWorldRule } from './backendShapes'
import { ApiError, request, requestAll, requestLenient } from './client'
import { listChapters, listManuscripts, syncManuscriptContent } from './manuscripts'
import type { Conflict, ConflictCheck, RuleAssessment, RuleExtraction, WorldRule } from './types'

// real 모드 AI — prolog-backend 06b8928의 REX 추출과 SCDS를 화면 모양으로 맞춘다.
//
// REX: 규칙 후보는 추출 작업 결과 안에만 있고 "추출 목록" API가 없다. 이 브라우저에서 요청한 추출 ID를 기억해 두고
//   목록을 부를 때 그 결과의 후보를 확정 규칙 뒤에 붙인다. 후보 ID는 "추출ID~번호"다.
// SCDS: 서버의 원고 전체 검사 한 건을 사용한다. 규칙 등록 없이 설정·관계·복선을 추적한다.

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
  duplicate_rule_id?: string | null
  duplicate_reason?: string | null
  duplicate_kind?: 'exact' | 'suggested' | null
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
  result_ids: (e.extracted_rules ?? [])
    .filter((c) => c.review_status === 'pending')
    .map((c) => candidateId(e.extraction_id, c.index)),
  skipped_reason: null,
  manuscript_id: e.manuscript_id,
})

async function fetchExtraction(token: string, projectId: string, r: RememberedExtraction) {
  try {
    return (
      await requestLenient<BackendRuleExtraction>('GET', extractionPath(projectId, r.manuscript_id, r.extraction_id), {
        accessToken: token,
      })
    ).data
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) forget(projectId, r.extraction_id)
    return null
  }
}

export async function extractRules(token: string, projectId: string, manuscriptId: string) {
  await syncManuscriptContent(token, projectId, manuscriptId)
  const e = (
    await requestLenient<BackendRuleExtraction>('POST', extractionPath(projectId, manuscriptId), { accessToken: token })
  ).data
  remember(projectId, { extraction_id: e.extraction_id, manuscript_id: e.manuscript_id })
  return toRuleJob(e)
}

export async function getRuleExtraction(token: string, projectId: string, manuscriptId: string, jobId: string) {
  return toRuleJob(
    (
      await requestLenient<BackendRuleExtraction>('GET', extractionPath(projectId, manuscriptId, jobId), {
        accessToken: token,
      })
    ).data,
  )
}

export async function listRules(token: string, projectId: string): Promise<WorldRule[]> {
  const [rules, extractions] = await Promise.all([
    requestAll<BackendWorldRule>(`${p(projectId)}/world-rules`, { accessToken: token }),
    Promise.all(remembered(projectId).map((r) => fetchExtraction(token, projectId, r))),
  ])
  // 백엔드 후보는 근거 장(source_chapter)을 비워 둔다. 근거 문장이 들어 있는 장을 찾아 채운다
  const manuscriptIds = [
    ...new Set(
      extractions.flatMap((e) => (e?.status === 'completed' && e.extracted_rules.length ? [e.manuscript_id] : [])),
    ),
  ]
  const chapterLists = new Map(
    await Promise.all(
      manuscriptIds.map(async (id) => [id, await listChapters(token, projectId, id).catch(() => [])] as const),
    ),
  )
  const squash = (t: string) => t.replace(/\s+/g, '')
  const chapterOf = (manuscriptId: string, evidence: string | null) =>
    evidence
      ? (chapterLists.get(manuscriptId)?.find((c) => squash(c.content).includes(squash(evidence)))?.chapter_no ?? null)
      : null

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
      evidence_sources: r.evidence_sources,
    }),
  )
  // 확정한 후보는 백엔드 규칙 목록에 이미 있다. 남은 후보(검토 대기·무시)만 번호를 이어 붙인다
  const candidates = extractions
    .flatMap((e) =>
      e?.status === 'completed'
        ? e.extracted_rules.filter((c) => c.review_status !== 'confirmed').map((c) => ({ e, c }))
        : [],
    )
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
        duplicate_rule_id: c.duplicate_rule_id,
        duplicate_reason: c.duplicate_reason,
        duplicate_kind: c.duplicate_kind,
      }
    })
  return [...confirmed, ...candidates]
}

async function reviewCandidate(
  token: string,
  projectId: string,
  id: string,
  body: {
    selected_indices?: number[]
    ignored_indices?: number[]
    edits?: Record<string, CandidateEdit>
    merge_targets?: Record<string, string>
  },
) {
  const { extractionId, index } = parseCandidate(id)
  const found = remembered(projectId).find((r) => r.extraction_id === extractionId)
  if (!found)
    throw new ApiError(404, {
      code: 'EXTRACTION_NOT_FOUND',
      message: '규칙 후보를 찾을 수 없어요. 규칙을 다시 추출해 주세요.',
      details: { index },
    })
  return request<BackendWorldRule[]>(
    'POST',
    `${extractionPath(projectId, found.manuscript_id, extractionId)}/confirm`,
    { body, accessToken: token },
  )
}

/** 후보를 고치면 확정 전까지 이 화면에서 들고 있다가 확정할 때 보낸다 */
export function editCandidate(id: string, input: CandidateEdit) {
  const clean = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined && v !== ''),
  ) as CandidateEdit
  candidateEdits.set(id, { ...candidateEdits.get(id), ...clean })
}

export async function mergeCandidate(token: string, projectId: string, id: string, ruleId: string) {
  const { index } = parseCandidate(id)
  const rules = await reviewCandidate(token, projectId, id, {
    selected_indices: [index],
    merge_targets: { [String(index)]: ruleId },
  })
  candidateEdits.delete(id)
  return rules[0] ?? null
}

export async function confirmCandidate(token: string, projectId: string, id: string) {
  const { index } = parseCandidate(id)
  const edit = candidateEdits.get(id)
  const created = await reviewCandidate(token, projectId, id, {
    selected_indices: [index],
    edits: edit ? { [index]: edit } : {},
  })
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
  analysis_kind?: ConflictCheck['analysis_kind']
  narrative?: ConflictCheck['narrative']
  assessments?: RuleAssessment[]
}

interface BackendConflict {
  source_evidence?: Array<{chapter_id: string; chapter_no: number; quote: string}>
  review_stale?: boolean
  conflict_id: string
  check_id: string | null
  character_id: string | null
  rule_id: string | null
  chapter_id: string | null
  chapter: number | null
  conflict_target: string | null
  matched_keyword: string | null
  manuscript_id?: string | null
  source_hash?: string | null
  edit_unavailable_reason?: string | null
  input_event: string
  detected_by: 'rule' | 'ai'
  severity: Conflict['severity'] | null
  advice: string | null
  status: Conflict['status']
  modified_content: string | null
  created_at: string
  resolved_at: string | null
}

const toCheck = (c: BackendCheck): ConflictCheck => ({
  job_id: c.check_id, status: c.status, result_ids: c.conflict_ids,
  skipped_reason: c.rule_result.skipped_reason,
  manuscript_id: c.narrative?.manuscript_id ?? null,
  analysis_kind: c.analysis_kind, assessments: c.assessments,
  narrative: c.narrative, keyword_candidate_count: c.rule_result.candidates.length,
})

/** One durable server job reads every chapter of the selected manuscript. */
export async function rescan(token: string, projectId: string,
  target?: { manuscriptId: string; chapterId: string }): Promise<ConflictCheck> {
  const manuscriptId = target?.manuscriptId ??
    (await listManuscripts(token, projectId)).find((m) => m.status === 'ready')?.manuscript_id
  if (!manuscriptId) return {job_id: 'no-manuscript', status: 'skipped', result_ids: [],
    skipped_reason: 'NO_MANUSCRIPT', manuscript_id: null}
  return toCheck(await request<BackendCheck>('POST',
    `${p(projectId)}/manuscripts/${manuscriptId}/narrative-reviews`, {accessToken: token}))
}

export async function latestNarrativeReview(token: string, projectId: string, manuscriptId: string) {
  const check = await request<BackendCheck | null>('GET',
    `${p(projectId)}/manuscripts/${manuscriptId}/narrative-reviews/latest`, {accessToken: token})
  return check ? toCheck(check) : null
}

export async function getConflictCheck(token: string, projectId: string, jobId: string) {
  return toCheck((await requestLenient<BackendCheck>('GET',
    `${p(projectId)}/conflict-checks/${jobId}`, {accessToken: token})).data)
}
export async function retryConflictCheck(token: string, projectId: string, jobId: string) {
  const previous = await getConflictCheck(token, projectId, jobId)
  if (previous.narrative) return rescan(token, projectId,
    {manuscriptId: previous.narrative.manuscript_id, chapterId: ''})
  return toCheck((await requestLenient<BackendCheck>('POST',
    `${p(projectId)}/conflict-checks/${jobId}/retry`, {accessToken: token})).data)
}

async function realConflicts(token: string, projectId: string) {
  const [rows, rules, characters] = await Promise.all([
    requestAll<BackendConflict>(`${p(projectId)}/conflicts`, { accessToken: token }),
    requestAll<BackendWorldRule>(`${p(projectId)}/world-rules`, { accessToken: token }),
    requestAll<BackendCharacter>(`${p(projectId)}/characters`, { accessToken: token }),
  ])
  const ruleOf = new Map(rules.map((r) => [r.rule_id, r]))
  const nameOf = new Map(characters.map((c) => [c.character_id, c.name]))
  const ordered = [...rows].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.conflict_id.localeCompare(b.conflict_id),
  )
  return ordered.map((c, i) => {
    const rule = c.rule_id ? ruleOf.get(c.rule_id) : undefined
    const ruleSource = rule?.evidence_sources?.find((source) => source.quote === rule.evidence) ?? rule?.evidence_sources?.[0]
    const conflict: Conflict = {
      conflict_id: c.conflict_id,
      manuscript_id: c.manuscript_id ?? null,
      source_hash: c.source_hash ?? null,
      edit_unavailable_reason: c.review_stale ? '이전 검사 결과예요. 현재 원고로 다시 검사해 주세요.' : c.edit_unavailable_reason ?? (c.source_hash ? null : '원문 위치를 확인하려면 다시 검사해 주세요.'),
      review_kind: c.detected_by === 'ai' ? 'ai' : 'keyword',
      index: i + 1,
      title:
        (c.review_stale ? '이전 원고의 검토 · ' : c.detected_by === 'rule' ? '미검토 키워드 단서 · ' : '') +
        (rule?.title ?? c.conflict_target ?? c.matched_keyword ?? '설정 충돌'),
      severity: c.severity ?? 'medium',
      status: c.status,
      rule_id: c.rule_id,
      evidence: c.source_evidence?.length ? c.source_evidence.map((e) => ({chapter: e.chapter_no, character: null, quote: e.quote, manuscript_id: c.manuscript_id})) : [
        { chapter: ruleSource?.chapter_no ?? rule?.source_chapter_no ?? 0, character: null, quote: ruleSource?.quote ?? rule?.evidence ?? rule?.description ?? '', manuscript_id: ruleSource?.manuscript_id },
        {
          chapter: c.chapter ?? 0,
          manuscript_id: c.manuscript_id,
          character: c.character_id ? (nameOf.get(c.character_id) ?? null) : null,
          quote: c.matched_keyword && c.input_event.includes(c.matched_keyword) ? c.matched_keyword : '정확한 인용을 확인하지 못했어요.',
        },
      ],
      anchor:
        !c.review_stale && c.chapter_id && c.matched_keyword && c.input_event.includes(c.matched_keyword)
          ? { chapter_id: c.chapter_id, quote: c.matched_keyword, context: c.input_event }
          : undefined,
      advice:
        c.advice ??
        `"${c.matched_keyword ?? c.conflict_target ?? ''}" 표현이 검색 단서와 일치했어요. AI가 의미를 검토하지 않은 이전 결과이므로 위반 여부는 판단할 수 없어요.`,
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
export async function resolveConflict(
  token: string,
  projectId: string,
  conflictId: string,
  body: { action: 'accepted' | 'ignored' | 'modified'; modified_content?: string; source_hash?: string | null },
) {
  await request<BackendConflict>('PATCH', `${p(projectId)}/conflicts/${conflictId}`, { body, accessToken: token })
  const after = (await listConflicts(token, projectId)).find((c) => c.conflict_id === conflictId)
  if (!after) throw new ApiError(404, { code: 'CONFLICT_NOT_FOUND', message: '충돌을 찾을 수 없어요.', details: {} })
  return after
}
