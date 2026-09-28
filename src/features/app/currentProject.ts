import { createContext, useContext } from 'react'
import type { Project } from '../../api/types'

export type CurrentProjectState =
  | { status: 'none' }
  | { status: 'loading'; projectId: string }
  | { status: 'error'; projectId: string; message: string }
  | { status: 'ready'; project: Project }

export interface CurrentProjectValue {
  state: CurrentProjectState
  reload: () => void
}

export const CurrentProjectContext = createContext<CurrentProjectValue>({ state: { status: 'none' }, reload: () => {} })

/** 주소의 /projects/:projectId 에 해당하는 프로젝트. 프로젝트 밖 화면에서는 status가 none이다. */
export function useCurrentProject() {
  return useContext(CurrentProjectContext)
}

/** 프로젝트 안 화면에서만 쓴다 — 아직 불러오기 전이면 null */
export function useProject(): Project | null {
  const { state } = useCurrentProject()
  return state.status === 'ready' ? state.project : null
}

export const projectPath = (projectId: string, sub = '') => `/projects/${projectId}${sub ? `/${sub}` : ''}`
