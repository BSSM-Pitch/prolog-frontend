import { request } from './client'
import type { StructureAnalysis, StructureMap, StructureNode } from './types'

// SSM 명세 — 스토리 구조 지도

const base = (projectId: string, manuscriptId: string) => `/projects/${projectId}/manuscripts/${manuscriptId}`

/** 4.4 최신 구조 지도 — 분석한 적 없으면 404 STRUCTURE_MAP_NOT_FOUND */
export function getStructureMap(token: string, projectId: string, manuscriptId: string) {
  return request<StructureMap>('GET', `${base(projectId, manuscriptId)}/structure-map`, { accessToken: token })
}

/** 4.1 구조 분석 요청 — 분량이 부족하면 422 MANUSCRIPT_TOO_SHORT */
export function analyzeStructure(token: string, projectId: string, manuscriptId: string, simulateFailure = false) {
  return request<StructureAnalysis>('POST', `${base(projectId, manuscriptId)}/structure-analyses`, { body: simulateFailure ? { simulate_failure: true } : {}, accessToken: token })
}

export function getAnalysis(token: string, projectId: string, manuscriptId: string, analysisId: string) {
  return request<StructureAnalysis>('GET', `${base(projectId, manuscriptId)}/structure-analyses/${analysisId}`, { accessToken: token })
}

/** 4.6 사건(노드) 수정 */
export function updateNode(token: string, projectId: string, manuscriptId: string, nodeId: string, input: { title?: string; summary?: string }) {
  return request<StructureNode>('PATCH', `${base(projectId, manuscriptId)}/structure-map/nodes/${nodeId}`, { body: input, accessToken: token })
}
