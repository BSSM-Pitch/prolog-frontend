import { request } from './client'
import type { Conflict, ConflictCheck, RuleExtraction, WorldRule } from './types'

// REX · SCDS 명세 — 설정 규칙과 충돌

const p = (projectId: string) => `/projects/${projectId}`

export function listRules(token: string, projectId: string) {
  return request<WorldRule[]>('GET', `${p(projectId)}/world-rules`, { accessToken: token })
}

export function addRule(token: string, projectId: string, input: { title?: string; description: string; violation_keywords: string[] }) {
  return request<WorldRule>('POST', `${p(projectId)}/world-rules`, { body: input, accessToken: token })
}

export function updateRule(token: string, projectId: string, ruleId: string, input: { title?: string; description?: string; violation_keywords?: string[] }) {
  return request<WorldRule>('PATCH', `${p(projectId)}/world-rules/${ruleId}`, { body: input, accessToken: token })
}

export function confirmRule(token: string, projectId: string, ruleId: string) {
  return request<WorldRule>('POST', `${p(projectId)}/world-rules/${ruleId}/confirm`, { accessToken: token })
}

export function ignoreRule(token: string, projectId: string, ruleId: string) {
  return request<WorldRule>('POST', `${p(projectId)}/world-rules/${ruleId}/ignore`, { accessToken: token })
}

export function deleteRule(token: string, projectId: string, ruleId: string) {
  return request<null>('DELETE', `${p(projectId)}/world-rules/${ruleId}`, { accessToken: token })
}

/** REX 4.1 규칙 추출 요청 */
export function extractRules(token: string, projectId: string, manuscriptId: string) {
  return request<RuleExtraction>('POST', `${p(projectId)}/manuscripts/${manuscriptId}/rule-extractions`, { accessToken: token })
}

export function getRuleExtraction(token: string, projectId: string, manuscriptId: string, jobId: string) {
  return request<RuleExtraction>('GET', `${p(projectId)}/manuscripts/${manuscriptId}/rule-extractions/${jobId}`, { accessToken: token })
}

export function listConflicts(token: string, projectId: string) {
  return request<Conflict[]>('GET', `${p(projectId)}/conflicts`, { accessToken: token })
}

/** SCDS 4.11 수용 / 무시 / 수정 */
export function resolveConflict(token: string, projectId: string, conflictId: string, body: { action: 'accepted' | 'ignored' | 'modified'; modified_content?: string }) {
  return request<Conflict>('PATCH', `${p(projectId)}/conflicts/${conflictId}`, { body, accessToken: token })
}

/** SCDS 4.13 재검사 — (명세 미정의) 챕터 대신 프로젝트 전체, simulate_failure는 목업 시연용 */
export function rescan(token: string, projectId: string, simulateFailure = false) {
  return request<ConflictCheck>('POST', `${p(projectId)}/rescan`, { body: simulateFailure ? { simulate_failure: true } : {}, accessToken: token })
}

export function getConflictCheck(token: string, projectId: string, jobId: string) {
  return request<ConflictCheck>('GET', `${p(projectId)}/conflict-checks/${jobId}`, { accessToken: token })
}

export function retryConflictCheck(token: string, projectId: string, jobId: string) {
  return request<ConflictCheck>('POST', `${p(projectId)}/conflict-checks/${jobId}/retry`, { accessToken: token })
}
