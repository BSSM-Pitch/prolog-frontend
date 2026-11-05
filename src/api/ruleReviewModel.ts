import type { ConflictCheck, RuleAssessment } from './types'

export interface CheckSnapshot {
  status: ConflictCheck['status']
  conflict_ids: string[]
  analysis_kind?: 'ai_rule_review' | 'legacy_keyword'
  assessments?: RuleAssessment[]
  rule_result: { candidates: unknown[]; skipped: boolean; skipped_reason: string | null }
}
const RUNNING = ['queued', 'analyzing']

export function aggregateChecks(jobId: string, checks: CheckSnapshot[], manuscriptId: string | null): ConflictCheck {
  if (!checks.length)
    return {
      job_id: jobId,
      result_ids: [],
      manuscript_id: manuscriptId,
      status: 'skipped',
      skipped_reason: 'NO_CONTENT',
    }
  const statuses = checks.map((c) => c.status)
  const result_ids = checks.flatMap((c) => c.conflict_ids)
  const base = {
    job_id: jobId,
    result_ids,
    manuscript_id: manuscriptId,
    skipped_reason: null,
    analysis_kind: checks.some((c) => c.analysis_kind === 'ai_rule_review')
      ? ('ai_rule_review' as const)
      : ('legacy_keyword' as const),
    assessments: checks.flatMap((c) => c.assessments ?? []),
    keyword_candidate_count: checks.reduce((n, c) => n + c.rule_result.candidates.length, 0),
  }
  if (statuses.some((s) => RUNNING.includes(s)))
    return { ...base, status: statuses.includes('analyzing') ? 'analyzing' : 'queued' }
  if (statuses.includes('failed')) return { ...base, status: 'failed' }
  const skipped = checks.find((c) => c.rule_result.skipped)
  if (checks.length && checks.every((c) => c.status === 'skipped' && c.rule_result.skipped))
    return { ...base, status: 'skipped', skipped_reason: skipped?.rule_result.skipped_reason ?? null }
  return { ...base, status: 'completed' }
}
