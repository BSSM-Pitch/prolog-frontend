import { useEffect } from 'react'
import * as api from '../api/media'
import { useResource } from '../lib/useResource'

export function useProjectImages(projectId: string) {
  const resource = useResource(
    projectId ? async (token) => ({ projectId, images: await api.listImages(token, projectId) }) : null,
    [projectId],
  )
  const { reload } = resource
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail === projectId) reload()
    }
    const refresh = () => reload()
    window.addEventListener('project-image-changed', changed)
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 30 * 60_000)
    return () => {
      window.removeEventListener('project-image-changed', changed)
      window.removeEventListener('focus', refresh)
      window.clearInterval(timer)
    }
  }, [projectId, reload])
  return { ...resource, data: resource.data?.projectId === projectId ? resource.data.images : null }
}
