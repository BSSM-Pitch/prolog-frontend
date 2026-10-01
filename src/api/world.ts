import type { BackendWorldRule } from './backendShapes'
import { request } from './client'
import { IS_REAL } from './config'
import type { Conflict, ConflictCheck, RuleExtraction, WorldRule } from './types'
import * as ai from './worldAi'

// REX · SCDS 명세 — 설정 규칙과 충돌
//
// real 모드: 규칙·AI 규칙 추출·후보·충돌 검사 모두 백엔드가 한다(화면 모양 변환은 worldAi.ts).

const p = (projectId: string) => `/projects/${projectId}`

/** real 모드 목록 — 백엔드 규칙 뒤에 AI 추출 후보를 붙이고 "R01" 번호를 매긴다 */
export function listRules(token: string, projectId: string) {
  if (IS_REAL) return ai.listRules(token, projectId)
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
  if (IS_REAL && ai.isCandidateId(ruleId)) {
    ai.editCandidate(ruleId, input)
    return listedRule(token, projectId, ruleId)
  }
  if (!IS_REAL) return request<WorldRule>('PATCH', `${p(projectId)}/world-rules/${ruleId}`, { body: input, accessToken: token })
  const body = input.title !== undefined && !input.title.trim() ? { ...input, title: undefined } : input
  await request<BackendWorldRule>('PATCH', `${p(projectId)}/world-rules/${ruleId}`, { body, accessToken: token })
  return listedRule(token, projectId, ruleId)
}

/** 후보 확정. real 모드는 백엔드 추출 결과의 후보를 확정해 규칙으로 만든다 */
export async function confirmRule(token: string, projectId: string, ruleId: string) {
  if (!IS_REAL) return request<WorldRule>('POST', `${p(projectId)}/world-rules/${ruleId}/confirm`, { accessToken: token })
  if (!ai.isCandidateId(ruleId)) return listedRule(token, projectId, ruleId)
  const created = await ai.confirmCandidate(token, projectId, ruleId)
  return created ? listedRule(token, projectId, created) : null
}

export async function ignoreRule(token: string, projectId: string, ruleId: string) {
  if (IS_REAL && ai.isCandidateId(ruleId)) return ai.ignoreCandidate(token, projectId, ruleId).then(() => listedRule(token, projectId, ruleId))
  return request<WorldRule>('POST', `${p(projectId)}/world-rules/${ruleId}/ignore`, { accessToken: token })
}

export async function deleteRule(token: string, projectId: string, ruleId: string) {
  // 후보는 지울 수 없어 무시로 남긴다
  if (IS_REAL && ai.isCandidateId(ruleId)) return ai.ignoreCandidate(token, projectId, ruleId).then(() => null)
  return request<null>('DELETE', `${p(projectId)}/world-rules/${ruleId}`, { accessToken: token })
}

/** REX 4.1 규칙 추출 요청 */
export function extractRules(token: string, projectId: string, manuscriptId: string) {
  if (IS_REAL) return ai.extractRules(token, projectId, manuscriptId)
  return request<RuleExtraction>('POST', `${p(projectId)}/manuscripts/${manuscriptId}/rule-extractions`, { accessToken: token })
}

export function getRuleExtraction(token: string, projectId: string, manuscriptId: string, jobId: string) {
  if (IS_REAL) return ai.getRuleExtraction(token, projectId, manuscriptId, jobId)
  return request<RuleExtraction>('GET', `${p(projectId)}/manuscripts/${manuscriptId}/rule-extractions/${jobId}`, { accessToken: token })
}

export function listConflicts(token: string, projectId: string) {
  if (IS_REAL) return ai.listConflicts(token, projectId)
  return request<Conflict[]>('GET', `${p(projectId)}/conflicts`, { accessToken: token })
}

/** SCDS 4.11 수용 / 무시 / 수정 */
export function resolveConflict(token: string, projectId: string, conflictId: string, body: { action: 'accepted' | 'ignored' | 'modified'; modified_content?: string }) {
  if (IS_REAL) return ai.resolveConflict(token, projectId, conflictId, body)
  return request<Conflict>('PATCH', `${p(projectId)}/conflicts/${conflictId}`, { body, accessToken: token })
}

/**
 * SCDS 4.13 재검사 — (명세 미정의) 챕터 대신 프로젝트 전체, simulate_failure는 목업 시연용.
 * 백엔드는 장 본문을 사건으로 저장해 검사한다(worldAi.ts rescan)
 */
export function rescan(token: string, projectId: string, simulateFailure = false) {
  if (IS_REAL) return ai.rescan(token, projectId)
  return request<ConflictCheck>('POST', `${p(projectId)}/rescan`, { body: simulateFailure ? { simulate_failure: true } : {}, accessToken: token })
}

export function getConflictCheck(token: string, projectId: string, jobId: string) {
  if (IS_REAL) return ai.getConflictCheck(token, projectId, jobId)
  return request<ConflictCheck>('GET', `${p(projectId)}/conflict-checks/${jobId}`, { accessToken: token })
}

export function retryConflictCheck(token: string, projectId: string, jobId: string) {
  if (IS_REAL) return ai.retryConflictCheck(token, projectId, jobId)
  return request<ConflictCheck>('POST', `${p(projectId)}/conflict-checks/${jobId}/retry`, { accessToken: token })
}
