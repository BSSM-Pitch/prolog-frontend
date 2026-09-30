import { isBackendId, type BackendWorldRule } from './backendShapes'
import { request, requestMock } from './client'
import { IS_REAL } from './config'
import type { Conflict, ConflictCheck, RuleExtraction, WorldRule } from './types'

// REX · SCDS 명세 — 설정 규칙과 충돌
//
// real 모드: 확정 규칙은 백엔드(직접 입력 경로)가 정본이다. AI 규칙 추출·후보(pending·ignored)·충돌 검사는
// 백엔드에 없어 목업이 한다. 후보를 확정하면 백엔드에 규칙으로 쓴다.

const p = (projectId: string) => `/projects/${projectId}`

/** real 모드 목록 — 백엔드 규칙을 목업에 옮긴 뒤 AI 후보와 함께 "R01" 번호를 붙여 받는다 */
export function listRules(token: string, projectId: string) {
  if (IS_REAL) return requestMock<WorldRule[]>('GET', `${p(projectId)}/world-rules`, { accessToken: token })
  return request<WorldRule[]>('GET', `${p(projectId)}/world-rules`, { accessToken: token })
}

async function listedRule(token: string, projectId: string, ruleId: string) {
  const rule = (await listRules(token, projectId)).find((r) => r.rule_id === ruleId)
  if (!rule) throw new Error(`rule ${ruleId} not listed`)
  return rule
}

/** 백엔드는 제목이 필수다. 화면에서 비워 두면 설명 앞부분을 제목으로 쓴다 */
const titleOf = (input: { title?: string; description: string }) => input.title?.trim() || input.description.trim().slice(0, 30)

export async function addRule(token: string, projectId: string, input: { title?: string; description: string; violation_keywords: string[] }) {
  if (!IS_REAL) return request<WorldRule>('POST', `${p(projectId)}/world-rules`, { body: input, accessToken: token })
  const created = await request<BackendWorldRule>('POST', `${p(projectId)}/world-rules`, { body: { ...input, title: titleOf(input) }, accessToken: token })
  return listedRule(token, projectId, created.rule_id)
}

export async function updateRule(token: string, projectId: string, ruleId: string, input: { title?: string; description?: string; violation_keywords?: string[] }) {
  if (!IS_REAL || !isBackendId(ruleId)) return request<WorldRule>('PATCH', `${p(projectId)}/world-rules/${ruleId}`, { body: input, accessToken: token })
  const body = input.title !== undefined && !input.title.trim() ? { ...input, title: undefined } : input
  await request<BackendWorldRule>('PATCH', `${p(projectId)}/world-rules/${ruleId}`, { body, accessToken: token })
  return listedRule(token, projectId, ruleId)
}

/** 후보 확정. real 모드는 후보(목업)를 백엔드 규칙으로 만들고 후보를 지운다 — 백엔드 origin은 user_added가 된다 */
export async function confirmRule(token: string, projectId: string, ruleId: string) {
  if (!IS_REAL) return request<WorldRule>('POST', `${p(projectId)}/world-rules/${ruleId}/confirm`, { accessToken: token })
  const candidate = await listedRule(token, projectId, ruleId)
  if (isBackendId(ruleId)) return candidate
  const created = await request<BackendWorldRule>('POST', `${p(projectId)}/world-rules`, {
    body: { title: titleOf(candidate), description: candidate.description, violation_keywords: candidate.violation_keywords },
    accessToken: token,
  })
  await requestMock<null>('DELETE', `${p(projectId)}/world-rules/${ruleId}`, { accessToken: token })
  return listedRule(token, projectId, created.rule_id)
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
