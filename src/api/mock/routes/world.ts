import type { Conflict, ConflictCheck, RuleExtraction, WorldRule } from '../../types'
import { requireProject, touchProject } from '../access'
import { findRuleCandidates, matchesKeyword, splitSentences } from '../ai'
import { emptyWorld, type MockDb, type MockJob } from '../db'
import type { DemoConflict, DemoRule } from '../demo'
import { fail, isResponse, nextId, noContent, ok, stamp, str, type Body, type MockRequest, type Route } from '../http'

const JOB_MS = 2500
const world = (db: MockDb, projectId: string) => (db.worlds[projectId] ??= emptyWorld())

/** 가장 최근에 수정한 준비된 원고 — 검사·추출 대상 */
function latestManuscript(db: MockDb, projectId: string) {
  return db.manuscripts.filter((m) => m.project_id === projectId && m.status === 'ready').sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null
}

const suppressionKey = (ruleOrTitle: string, chapter: number, quote: string) => `${ruleOrTitle}|${chapter}|${quote.replace(/\s+/g, '')}`

function toRule(r: DemoRule): WorldRule {
  return { ...r }
}

function toConflict(w: ReturnType<typeof world>, c: DemoConflict): Conflict {
  return {
    conflict_id: c.conflict_id,
    index: w.conflicts.indexOf(c) + 1,
    title: c.title,
    severity: c.severity,
    status: c.status,
    rule_id: c.rule_id ?? null,
    evidence: c.evidence,
    advice: c.advice,
    modified_content: c.modified_content ?? null,
    resolved_at: c.resolved_at ?? null,
  }
}

function toJob(j: MockJob): ConflictCheck & RuleExtraction {
  return { job_id: j.job_id, status: j.status, result_ids: j.result_ids, skipped_reason: j.skipped_reason, manuscript_id: j.manuscript_id }
}

/** 목업: 끝날 시간이 된 작업의 결과를 만든다 */
function settleJobs(db: MockDb) {
  for (const j of db.jobs) {
    if (j.kind === 'structure_analysis' || (j.status !== 'queued' && j.status !== 'analyzing') || j.ready_at === null) continue
    if (j.ready_at - JOB_MS / 2 <= Date.now() && j.status === 'queued') j.status = 'analyzing'
    if (j.ready_at > Date.now()) continue
    j.ready_at = null
    if (j.will_fail) {
      j.status = 'failed'
      j.will_fail = false
      continue
    }
    const w = world(db, j.project_id)
    const chapters = db.chapters.filter((c) => c.manuscript_id === j.manuscript_id)

    if (j.kind === 'rule_extraction') {
      // 이미 있는 규칙의 근거 문장을 포함하거나 그 안에 들어가는 문장은 같은 규칙으로 본다
      const known = w.rules.map((r) => (r.evidence ?? '').replace(/[.。]$/, '')).filter(Boolean)
      const found = findRuleCandidates(chapters).filter((c) => !known.some((k) => c.sentence.includes(k) || k.includes(c.sentence.replace(/[.。]$/, ''))))
      for (const f of found.slice(0, 5)) {
        const rule: DemoRule = {
          rule_id: nextId(db, 'wr'),
          code: nextCode(w.rules),
          title: `${f.chapter_no}장 규칙`,
          description: f.sentence.replace(/[.。]$/, ''),
          violation_keywords: [],
          origin: 'ai_extracted',
          status: 'pending',
          source_chapter: f.chapter_no,
          evidence: f.sentence,
        }
        w.rules.push(rule)
        j.result_ids.push(rule.rule_id)
      }
      j.status = 'completed'
      continue
    }

    // conflict_check: 확정 규칙의 판정 키워드와 맞는 문장을 찾는다 (SCDS 룰 기반 후보 + AI 조언)
    for (const rule of w.rules.filter((r) => r.status === 'confirmed' && r.violation_keywords.length > 0)) {
      for (const c of chapters) {
        for (const sentence of splitSentences(c.content)) {
          // 규칙의 근거 문장 자체는 위반이 아니다
          if (rule.evidence && sentence.includes(rule.evidence.replace(/[.。]$/, ''))) continue
          if (!rule.violation_keywords.some((k) => matchesKeyword(sentence, k))) continue
          const key = suppressionKey(rule.rule_id, c.chapter_no, sentence)
          const exists = w.conflicts.some((x) => x.rule_id === rule.rule_id && x.evidence.some((e) => e.chapter === c.chapter_no && e.quote === sentence))
          if (exists || db.suppressions.includes(key)) continue
          const conflict: DemoConflict = {
            conflict_id: nextId(db, 'conf'),
            title: `${rule.code} ${rule.title} 규칙과 ${c.chapter_no}장`,
            severity: 'medium',
            status: 'pending',
            rule_id: rule.rule_id,
            evidence: [
              { chapter: rule.source_chapter ?? 0, character: null, quote: rule.evidence ?? rule.description },
              { chapter: c.chapter_no, character: null, quote: sentence },
            ],
            advice: `“${rule.description}” 규칙과 ${c.chapter_no}장 장면이 어긋나 보여요. 장면의 시점이나 조건을 고치거나, 규칙에 예외가 있다는 단서를 넣어 보세요.`,
          }
          w.conflicts.push(conflict)
          j.result_ids.push(conflict.conflict_id)
        }
      }
    }
    j.status = 'completed'
  }
}

function findRule(req: MockRequest, db: MockDb, params: Record<string, string>) {
  const access = requireProject(req, db, params.projectId, 'editor')
  if (isResponse(access)) return access
  const rule = world(db, params.projectId).rules.find((r) => r.rule_id === params.ruleId)
  return rule ?? fail(404, 'WORLD_RULE_NOT_FOUND', '규칙을 찾을 수 없어요.')
}

/** 가장 큰 R 번호 다음 번호 */
const nextCode = (rules: DemoRule[]) => `R${String(rules.reduce((max, r) => Math.max(max, Number(r.code.slice(1)) || 0), 0) + 1).padStart(2, '0')}`

const keywordsFrom = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])

const rules = '/projects/:projectId/world-rules'
const conflicts = '/projects/:projectId/conflicts'

export const worldRoutes: Route[] = [
  // ───────── REX · 설정 규칙 ─────────
  [
    'GET',
    rules,
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      settleJobs(db)
      return ok(200, world(db, projectId).rules.map(toRule), { next_cursor: null })
    },
  ],
  [
    // 4.6 사용자 직접 규칙 추가
    'POST',
    rules,
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const b = (req.body ?? {}) as Body
      const description = str(b.description)
      if (!description) return fail(400, 'INVALID_INPUT', '규칙 내용을 입력해 주세요.', { field: 'description' })
      const w = world(db, projectId)
      const rule: DemoRule = {
        rule_id: nextId(db, 'wr'),
        code: nextCode(w.rules),
        title: str(b.title) || '직접 추가한 규칙',
        description,
        violation_keywords: keywordsFrom(b.violation_keywords),
        origin: 'user_added',
        status: 'confirmed',
        source_chapter: null,
        evidence: null,
      }
      w.rules.push(rule)
      touchProject(db, projectId)
      return ok(201, toRule(rule))
    },
  ],
  [
    // 4.7 규칙 수정 — AI 추출본도 자유롭게 고칠 수 있다
    'PATCH',
    `${rules}/:ruleId`,
    (req, db, params) => {
      const rule = findRule(req, db, params)
      if (isResponse(rule)) return rule
      const b = (req.body ?? {}) as Body
      if (b.title !== undefined) rule.title = str(b.title) || rule.title
      if (b.description !== undefined) {
        if (!str(b.description)) return fail(400, 'INVALID_INPUT', '규칙 내용을 입력해 주세요.', { field: 'description' })
        rule.description = str(b.description)
      }
      if (b.violation_keywords !== undefined) rule.violation_keywords = keywordsFrom(b.violation_keywords)
      touchProject(db, params.projectId)
      return ok(200, toRule(rule))
    },
  ],
  [
    // (명세 미정의) 후보 하나를 확정 — 명세는 rule-extractions/{id}/confirm 에 selected_indices로 한꺼번에 확정
    'POST',
    `${rules}/:ruleId/confirm`,
    (req, db, params) => {
      const rule = findRule(req, db, params)
      if (isResponse(rule)) return rule
      if (rule.status === 'confirmed') return fail(409, 'INVALID_STATUS_TRANSITION', '이미 확정한 규칙이에요.')
      rule.status = 'confirmed'
      touchProject(db, params.projectId)
      return ok(200, toRule(rule))
    },
  ],
  [
    // (명세 미정의) 후보 무시 — 목록에서 숨기고 다시 추출해도 나오지 않게 둔다
    'POST',
    `${rules}/:ruleId/ignore`,
    (req, db, params) => {
      const rule = findRule(req, db, params)
      if (isResponse(rule)) return rule
      if (rule.status !== 'pending') return fail(409, 'INVALID_STATUS_TRANSITION', '검토 대기 중인 후보만 무시할 수 있어요.')
      rule.status = 'ignored'
      return ok(200, toRule(rule))
    },
  ],
  [
    'DELETE',
    `${rules}/:ruleId`,
    (req, db, params) => {
      const rule = findRule(req, db, params)
      if (isResponse(rule)) return rule
      const w = world(db, params.projectId)
      w.rules = w.rules.filter((r) => r !== rule)
      touchProject(db, params.projectId)
      return noContent()
    },
  ],
  [
    // 4.1 규칙 추출 요청 (가장 최근 원고 대상)
    'POST',
    '/projects/:projectId/manuscripts/:manuscriptId/rule-extractions',
    (req, db, { projectId, manuscriptId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      if (!db.manuscripts.some((m) => m.manuscript_id === manuscriptId && m.project_id === projectId)) return fail(404, 'MANUSCRIPT_NOT_FOUND', '원고를 찾을 수 없어요.')
      const job: MockJob = {
        job_id: nextId(db, 'rex'),
        project_id: projectId,
        kind: 'rule_extraction',
        status: 'queued',
        manuscript_id: manuscriptId,
        ready_at: Date.now() + JOB_MS,
        will_fail: false,
        result_ids: [],
        skipped_reason: null,
        created_at: stamp(),
      }
      db.jobs.push(job)
      return ok(202, toJob(job))
    },
  ],
  [
    'GET',
    '/projects/:projectId/manuscripts/:manuscriptId/rule-extractions/:jobId',
    (req, db, { projectId, jobId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      settleJobs(db)
      const job = db.jobs.find((j) => j.job_id === jobId && j.project_id === projectId)
      return job ? ok(200, toJob(job)) : fail(404, 'RULE_EXTRACTION_NOT_FOUND', '추출 작업을 찾을 수 없어요.')
    },
  ],

  // ───────── SCDS · 설정 충돌 ─────────
  [
    'GET',
    conflicts,
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      settleJobs(db)
      const w = world(db, projectId)
      const status = req.query.status
      return ok(200, w.conflicts.filter((c) => !status || c.status === status).map((c) => toConflict(w, c)), { next_cursor: null })
    },
  ],
  [
    // 4.11 사용자 처리 (수용 / 무시 / 수정)
    'PATCH',
    `${conflicts}/:conflictId`,
    (req, db, { projectId, conflictId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const w = world(db, projectId)
      const c = w.conflicts.find((x) => x.conflict_id === conflictId)
      if (!c) return fail(404, 'CONFLICT_NOT_FOUND', '충돌 항목을 찾을 수 없어요.')
      if (c.status !== 'pending') return fail(409, 'INVALID_STATUS_TRANSITION', '이미 처리한 충돌이에요.')
      const b = (req.body ?? {}) as Body
      const action = b.action
      if (action !== 'accepted' && action !== 'ignored' && action !== 'modified') return fail(400, 'INVALID_INPUT', '처리 방법을 골라 주세요.')

      if (action === 'modified') {
        const content = str(b.modified_content)
        if (!content) return fail(400, 'INVALID_INPUT', '수정할 문장을 입력해 주세요.', { field: 'modified_content' })
        // 목업: 원고에서 두 번째 근거 문장을 고친 문장으로 바꿔 넣는다
        const target = c.evidence[c.evidence.length - 1]
        const ms = latestManuscript(db, projectId)
        const chapter = ms && db.chapters.find((ch) => ch.manuscript_id === ms.manuscript_id && ch.chapter_no === target.chapter)
        if (chapter && chapter.content.includes(target.quote)) {
          chapter.content = chapter.content.replace(target.quote, content)
          chapter.updated_at = stamp()
          ms.updated_at = stamp()
        }
        c.modified_content = content
      }
      if (action === 'ignored') {
        const last = c.evidence[c.evidence.length - 1]
        db.suppressions.push(suppressionKey(c.rule_id ?? c.title, last.chapter, last.quote))
      }
      c.status = action
      c.resolved_at = stamp()
      touchProject(db, projectId)
      return ok(200, toConflict(w, c))
    },
  ],
  [
    // 4.13 챕터 단위 재검사 (SCDS-007) — 목업은 가장 최근 원고 전체를 다시 본다
    'POST',
    '/projects/:projectId/rescan',
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const w = world(db, projectId)
      const ms = latestManuscript(db, projectId)
      const hasReference = w.rules.some((r) => r.status === 'confirmed') || w.characters.length > 0
      const job: MockJob = {
        job_id: nextId(db, 'chk'),
        project_id: projectId,
        kind: 'conflict_check',
        status: hasReference && ms ? 'queued' : 'skipped',
        manuscript_id: ms?.manuscript_id ?? null,
        ready_at: hasReference && ms ? Date.now() + JOB_MS : null,
        // 목업: 요청에 simulate_failure가 있으면 AI 단계 실패를 흉내 낸다
        will_fail: Boolean((req.body as Body)?.simulate_failure),
        result_ids: [],
        skipped_reason: !ms ? 'NO_MANUSCRIPT' : hasReference ? null : 'NO_REFERENCE_DATA',
        created_at: stamp(),
      }
      db.jobs.push(job)
      return ok(202, toJob(job))
    },
  ],
  [
    'GET',
    '/projects/:projectId/conflict-checks/:jobId',
    (req, db, { projectId, jobId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      settleJobs(db)
      const job = db.jobs.find((j) => j.job_id === jobId && j.project_id === projectId)
      return job ? ok(200, toJob(job), { retry_after_ms: job.status === 'queued' || job.status === 'analyzing' ? 1000 : null }) : fail(404, 'CONFLICT_CHECK_NOT_FOUND', '검사 작업을 찾을 수 없어요.')
    },
  ],
  [
    'POST',
    '/projects/:projectId/conflict-checks/:jobId/retry',
    (req, db, { projectId, jobId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const job = db.jobs.find((j) => j.job_id === jobId && j.project_id === projectId)
      if (!job) return fail(404, 'CONFLICT_CHECK_NOT_FOUND', '검사 작업을 찾을 수 없어요.')
      if (job.status !== 'failed') return fail(409, 'INVALID_STATUS_TRANSITION', '실패한 검사만 다시 시도할 수 있어요.')
      job.status = 'queued'
      job.ready_at = Date.now() + JOB_MS
      return ok(202, toJob(job))
    },
  ],
]
