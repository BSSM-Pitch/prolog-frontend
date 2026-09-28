import { request } from './client'
import type { Chapter, Manuscript, ManuscriptSource } from './types'

// MSU 명세

const base = (projectId: string) => `/projects/${projectId}/manuscripts`

export function listManuscripts(accessToken: string, projectId: string) {
  return request<Manuscript[]>('GET', base(projectId), { accessToken, query: { limit: '100' } })
}

export function createManuscript(accessToken: string, projectId: string, input: { title: string; source_type: ManuscriptSource }) {
  return request<Manuscript>('POST', base(projectId), { body: input, accessToken })
}

export function getManuscript(accessToken: string, projectId: string, manuscriptId: string) {
  return request<Manuscript>('GET', `${base(projectId)}/${manuscriptId}`, { accessToken })
}

export function deleteManuscript(accessToken: string, projectId: string, manuscriptId: string) {
  return request<null>('DELETE', `${base(projectId)}/${manuscriptId}`, { accessToken })
}

/** 4.6 원고 파일 업로드 (multipart, 필드명 file) */
export function uploadManuscriptFile(accessToken: string, projectId: string, manuscriptId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<Manuscript>('POST', `${base(projectId)}/${manuscriptId}/file`, { body: form, accessToken })
}

export function listChapters(accessToken: string, projectId: string, manuscriptId: string) {
  return request<Chapter[]>('GET', `${base(projectId)}/${manuscriptId}/chapters`, { accessToken })
}
