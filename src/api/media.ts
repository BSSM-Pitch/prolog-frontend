import { request } from './client'
import { fileRequest } from './files'
export interface ProjectImage {
  target_id: string
  kind: 'cover' | 'portrait'
  url: string
  width: number
  height: number
}
export const listImages = (token: string, projectId: string) =>
  request<ProjectImage[]>('GET', `/projects/${projectId}/media`, { accessToken: token })
export async function uploadImage(
  token: string,
  projectId: string,
  kind: ProjectImage['kind'],
  targetId: string,
  file: File,
): Promise<ProjectImage> {
  const response = await fileRequest(token, `/projects/${projectId}/media/${kind}/${targetId}`, 'PUT', file)
  return (await response.json()).data
}
export const removeImage = (token: string, projectId: string, kind: ProjectImage['kind'], targetId: string) =>
  request<void>('DELETE', `/projects/${projectId}/media/${kind}/${targetId}`, { accessToken: token })
