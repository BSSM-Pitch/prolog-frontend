import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateChecks } from '../src/api/ruleReviewModel.ts'
import { manuscriptIssues } from '../src/features/manuscripts/manuscriptReviewModel.ts'
const snapshot = (status, verdicts = []) => ({ status, analysis_kind: 'ai_rule_review', conflict_ids: [], rule_result: { candidates: ['7시간'], skipped: false, skipped_reason: null }, assessments: verdicts.map((verdict) => ({ rule_id: 'r1', verdict })) })
test('a keyword candidate with a supported rule is not counted as a conflict', () => {
  const result = aggregateChecks('job', [snapshot('completed', ['supports'])], 'ms')
  assert.equal(result.status, 'completed')
  assert.equal(result.keyword_candidate_count, 1)
  assert.equal(result.assessments[0].verdict, 'supports')
  assert.deepEqual(result.result_ids, [])
})
test('failed and partially running scans cannot masquerade as completed no-conflict results', () => {
  assert.equal(aggregateChecks('j', [snapshot('completed'), snapshot('failed', ['undetermined'])], 'm').status, 'failed')
  assert.equal(aggregateChecks('j', [snapshot('completed'), snapshot('analyzing')], 'm').status, 'analyzing')
  assert.equal(aggregateChecks('j', [], 'm').status, 'skipped')
})
test('legacy keyword-only hits never underline manuscript text as a proven violation', () => {
  const report = { conflict_id: 'legacy', review_kind: 'keyword', status: 'pending', anchor: { chapter_id: 'c1', quote: '7시간' } }
  assert.deepEqual(manuscriptIssues('정확히 7시간 뒤', 'c1', [report]), [])
})
