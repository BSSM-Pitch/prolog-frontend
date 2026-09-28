import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useMatch } from 'react-router-dom'
import * as projectsApi from '../../api/projects'
import { useSession } from '../../auth/session'
import { describeError } from '../../lib/errors'
import { CurrentProjectContext, type CurrentProjectState } from './currentProject'
import { Sidebar } from './Sidebar'
import './AppShell.css'

const COLLAPSE_KEY = 'prolog.sidebar.collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/** 로그인 이후 화면의 공통 틀: 왼쪽 사이드바 + 작업 영역 */
export function AppShell() {
  const { withAuth } = useSession()
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const match = useMatch('/projects/:projectId/*')
  const projectId = match?.params.projectId && match.params.projectId !== 'new' ? match.params.projectId : null

  const [loaded, setLoaded] = useState<{ key: string; state: CurrentProjectState } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const requestKey = projectId ? `${projectId}|${reloadKey}` : ''

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    withAuth((token) => projectsApi.getProject(token, projectId))
      .then((project) => !cancelled && setLoaded({ key: requestKey, state: { status: 'ready', project } }))
      .catch((e) => !cancelled && setLoaded({ key: requestKey, state: { status: 'error', projectId, message: describeError(e) } }))
    return () => {
      cancelled = true
    }
  }, [projectId, requestKey, withAuth])

  const state = useMemo<CurrentProjectState>(() => {
    if (!projectId) return { status: 'none' }
    if (loaded?.key === requestKey) return loaded.state
    // 같은 프로젝트를 다시 불러오는 동안에는 이전 정보를 그대로 보여 준다
    if (loaded?.state.status === 'ready' && loaded.state.project.project_id === projectId) return loaded.state
    return { status: 'loading', projectId }
  }, [projectId, requestKey, loaded])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])
  const value = useMemo(() => ({ state, reload }), [state, reload])

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        // 저장하지 못해도 이번 화면에서는 접힌 상태 유지
      }
      return !c
    })
  }

  return (
    <CurrentProjectContext.Provider value={value}>
      <div className={collapsed ? 'app app--collapsed' : 'app'}>
        <Sidebar project={state.status === 'ready' ? state.project : null} collapsed={collapsed} onToggle={toggle} />
        <main className="app__main">
          {state.status === 'error' ? (
            <div className="app__problem" role="alert">
              <h1>프로젝트를 열 수 없어요</h1>
              <p>{state.message}</p>
              <Link className="btn btn--outline" to="/projects">
                내 프로젝트로 돌아가기
              </Link>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </CurrentProjectContext.Provider>
  )
}
