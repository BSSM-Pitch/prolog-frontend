import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../auth/session'
import { describeError } from './errors'

interface Loaded<T> {
  key: string
  data: T | null
  error: string | null
}

export interface Resource<T> {
  data: T | null
  error: string | null
  loading: boolean
  /** 처음부터 다시 불러온다 (화면에는 이전 데이터를 유지) */
  reload: () => void
  /** 서버 응답 없이 화면 데이터만 바꾼다 (낙관적 갱신) */
  setData: (update: (prev: T | null) => T | null) => void
}

/**
 * 인증이 필요한 GET을 불러온다. deps가 바뀌면 다시 불러오고, 바뀌는 동안에는 loading이 true가 된다.
 * fetcher가 null이면 아무것도 하지 않는다 (예: 아직 프로젝트를 모를 때).
 */
export function useResource<T>(fetcher: ((token: string) => Promise<T>) | null, deps: unknown[]): Resource<T> {
  const { withAuth } = useSession()
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const key = `${JSON.stringify(deps)}|${reloadKey}`
  const enabled = fetcher !== null

  useEffect(() => {
    if (!fetcher) return
    let cancelled = false
    withAuth(fetcher)
      .then((data) => !cancelled && setLoaded({ key, data, error: null }))
      .catch((e) => !cancelled && setLoaded((prev) => ({ key, data: prev?.data ?? null, error: describeError(e) })))
    return () => {
      cancelled = true
    }
    // fetcher는 매 렌더 새로 만들어지므로 deps(→ key)로만 다시 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, withAuth])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])
  const setData = useCallback((update: (prev: T | null) => T | null) => setLoaded((prev) => (prev ? { ...prev, data: update(prev.data) } : prev)), [])

  const current = loaded?.key === key
  return {
    data: loaded?.data ?? null,
    error: current ? loaded.error : null,
    loading: enabled && !current,
    reload,
    setData,
  }
}

/** 조건이 참인 동안 ms마다 fn을 실행한다 (비동기 작업 상태 폴링) */
export function useInterval(fn: () => void, ms: number, active: boolean) {
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(fn, ms)
    return () => window.clearInterval(id)
  }, [fn, ms, active])
}
