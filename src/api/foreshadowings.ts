import { request, requestWithMeta } from './client'
import type { Advisory, Foreshadowing, SimilarCandidate } from './types'

// FTS 명세 — 복선

const base = (projectId: string) => `/projects/${projectId}/foreshadowings`
const one = (projectId: string, id: string) => `${base(projectId)}/${id}`

export function listForeshadowings(token: string, projectId: string) {
  return request<Foreshadowing[]>('GET', base(projectId), { accessToken: token })
}

/** 4.2 생성 — 비슷한 복선이 있으면 meta.similar_candidates로 알려 준다 (생성은 막지 않음) */
export function createForeshadowing(token: string, projectId: string, input: { title: string; description?: string; setup_chapter: number; linked_characters?: string[] }) {
  return requestWithMeta<Foreshadowing, { similar_candidates?: SimilarCandidate[] }>('POST', base(projectId), { body: input, accessToken: token })
}

export function updateForeshadowing(token: string, projectId: string, id: string, input: { title?: string; description?: string; setup_chapter?: number; linked_characters?: string[] }) {
  return request<Foreshadowing>('PATCH', one(projectId, id), { body: input, accessToken: token })
}

export function deleteForeshadowing(token: string, projectId: string, id: string) {
  return request<null>('DELETE', one(projectId, id), { accessToken: token })
}

export function addLinkedChapter(token: string, projectId: string, id: string, chapter: number) {
  return request<Foreshadowing>('POST', `${one(projectId, id)}/linked-chapters`, { body: { chapter }, accessToken: token })
}

export function removeLinkedChapter(token: string, projectId: string, id: string, chapter: number) {
  return request<null>('DELETE', `${one(projectId, id)}/linked-chapters/${chapter}`, { accessToken: token })
}

/** 4.8 회수 처리 — 설치 장보다 앞이면 400 INVALID_PAYOFF_CHAPTER */
export function setPayoff(token: string, projectId: string, id: string, payoff_chapter: number) {
  return request<Foreshadowing>('PUT', `${one(projectId, id)}/payoff`, { body: { payoff_chapter }, accessToken: token })
}

/** 4.9 회수 취소 — 미회수면 409 PAYOFF_NOT_SET */
export function cancelPayoff(token: string, projectId: string, id: string) {
  return request<Foreshadowing>('DELETE', `${one(projectId, id)}/payoff`, { accessToken: token })
}

export function listAdvisories(token: string, projectId: string, currentChapter: number) {
  return request<Advisory[]>('GET', `${base(projectId)}/unresolved/advisories`, { query: { current_chapter: String(currentChapter) }, accessToken: token })
}
