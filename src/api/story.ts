import type { BackendCharacter } from './backendShapes'
import { request, requestAll, requestLenient } from './client'
import { IS_REAL } from './config'
import { syncManuscriptContent } from './manuscripts'
import type { StructureAnalysis, StructureMap, StructureNode } from './types'

// SSM 명세 — 스토리 구조 지도

const base = (projectId: string, manuscriptId: string) => `/projects/${projectId}/manuscripts/${manuscriptId}`

/** 백엔드 노드는 인물을 ID로, 요약·장 번호를 없을 수 있게 준다 */
interface BackendNode {
  node_id: string
  type: StructureNode['type']
  chapter: number | null
  title: string
  summary: string | null
  character_ids: string[]
  is_user_edited: boolean
}

type BackendMap = Omit<StructureMap, 'nodes' | 'edges'> & { nodes: BackendNode[]; edges: Array<{ from_node_id: string; to_node_id: string; relation: string }> }

const characterNames = async (token: string, projectId: string) =>
  new Map((await requestAll<BackendCharacter>(`/projects/${projectId}/characters`, { accessToken: token }).catch(() => [])).map((c) => [c.character_id, c.name]))

const toNode = (n: BackendNode, names: Map<string, string>): StructureNode => ({
  node_id: n.node_id,
  type: n.type,
  chapter: n.chapter ?? 0,
  title: n.title,
  summary: n.summary ?? '',
  characters: n.character_ids.map((id) => names.get(id)).filter((name): name is string => !!name),
})

/** 4.4 최신 구조 지도 — 분석한 적 없으면 404 STRUCTURE_MAP_NOT_FOUND */
export async function getStructureMap(token: string, projectId: string, manuscriptId: string) {
  if (!IS_REAL) return request<StructureMap>('GET', `${base(projectId, manuscriptId)}/structure-map`, { accessToken: token })
  const [map, names] = await Promise.all([request<BackendMap>('GET', `${base(projectId, manuscriptId)}/structure-map`, { accessToken: token }), characterNames(token, projectId)])
  return {
    manuscript_id: map.manuscript_id,
    acts: map.acts,
    nodes: map.nodes.map((n) => toNode(n, names)),
    // 백엔드 관계는 자유 문자열이다. 화면은 원인(causes)·영향(affects)만 구분한다
    edges: map.edges.map((e) => ({ ...e, relation: e.relation === 'affects' ? 'affects' : 'causes' })),
  } satisfies StructureMap
}

/** 백엔드 분석 작업은 실패해도 200 + data(status=failed) + error로 온다 */
const toAnalysis = (a: StructureAnalysis): StructureAnalysis => ({ analysis_id: a.analysis_id, status: a.status, manuscript_id: a.manuscript_id })

/** 4.1 구조 분석 요청 — 분량이 부족하면 422 MANUSCRIPT_TOO_SHORT (simulate_failure는 목업 시연용) */
export async function analyzeStructure(token: string, projectId: string, manuscriptId: string, simulateFailure = false) {
  if (IS_REAL) await syncManuscriptContent(token, projectId, manuscriptId)
  if (IS_REAL) return toAnalysis(await request<StructureAnalysis>('POST', `${base(projectId, manuscriptId)}/structure-analyses`, { accessToken: token }))
  return request<StructureAnalysis>('POST', `${base(projectId, manuscriptId)}/structure-analyses`, { body: simulateFailure ? { simulate_failure: true } : {}, accessToken: token })
}

export async function getAnalysis(token: string, projectId: string, manuscriptId: string, analysisId: string) {
  if (IS_REAL) return toAnalysis((await requestLenient<StructureAnalysis>('GET', `${base(projectId, manuscriptId)}/structure-analyses/${analysisId}`, { accessToken: token })).data)
  return request<StructureAnalysis>('GET', `${base(projectId, manuscriptId)}/structure-analyses/${analysisId}`, { accessToken: token })
}

/** 4.6 사건(노드) 수정 */
export async function updateNode(token: string, projectId: string, manuscriptId: string, nodeId: string, input: { title?: string; summary?: string }) {
  if (!IS_REAL) return request<StructureNode>('PATCH', `${base(projectId, manuscriptId)}/structure-map/nodes/${nodeId}`, { body: input, accessToken: token })
  const [node, names] = await Promise.all([request<BackendNode>('PATCH', `${base(projectId, manuscriptId)}/structure-map/nodes/${nodeId}`, { body: input, accessToken: token }), characterNames(token, projectId)])
  return toNode(node, names)
}
