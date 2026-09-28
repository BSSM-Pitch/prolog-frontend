import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import * as authApi from '../api/auth'
import type { AuthResult, AuthTokens, User } from '../api/types'

const TOKEN_KEY = 'prolog.auth.tokens'

function readTokens(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as AuthTokens) : null
  } catch {
    return null
  }
}

function writeTokens(tokens: AuthTokens | null) {
  try {
    if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // 저장소를 쓸 수 없으면 이번 탭에서만 로그인 유지
  }
}

type Status = 'loading' | 'signed-in' | 'signed-out'

interface SessionValue {
  status: Status
  user: User | null
  signIn: (result: AuthResult) => void
  signOut: () => Promise<void>
  /** 인증이 필요한 API 호출. 401이면 토큰을 한 번 재발급해 다시 시도하고, 그래도 안 되면 로그아웃한다. */
  withAuth: <T>(call: (accessToken: string) => Promise<T>) => Promise<T>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(readTokens)
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<Status>(tokens ? 'loading' : 'signed-out')

  // 새로고침 시 저장된 토큰으로 내 정보를 다시 불러온다. 액세스 토큰이 만료됐으면 한 번 재발급한다.
  useEffect(() => {
    if (status !== 'loading' || !tokens) return
    let cancelled = false
    ;(async () => {
      try {
        let me: User
        try {
          me = await authApi.getMe(tokens.access_token)
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 401) throw e
          const next = await authApi.refreshToken(tokens.refresh_token)
          writeTokens(next)
          if (!cancelled) setTokens(next)
          me = await authApi.getMe(next.access_token)
        }
        if (!cancelled) {
          setUser(me)
          setStatus('signed-in')
        }
      } catch {
        writeTokens(null)
        if (!cancelled) {
          setTokens(null)
          setStatus('signed-out')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, tokens])

  const signIn = useCallback((result: AuthResult) => {
    writeTokens(result.tokens)
    setTokens(result.tokens)
    setUser(result.user)
    setStatus('signed-in')
  }, [])

  const signOut = useCallback(async () => {
    if (tokens) {
      try {
        await authApi.logout(tokens.refresh_token)
      } catch {
        // 서버 폐기에 실패해도 로컬 세션은 지운다
      }
    }
    writeTokens(null)
    setTokens(null)
    setUser(null)
    setStatus('signed-out')
  }, [tokens])

  const withAuth = useCallback(
    async <T,>(call: (accessToken: string) => Promise<T>): Promise<T> => {
      if (!tokens) throw new ApiError(401, { code: 'UNAUTHORIZED', message: '로그인이 필요해요.', details: {} })
      try {
        return await call(tokens.access_token)
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) throw e
        try {
          const next = await authApi.refreshToken(tokens.refresh_token)
          writeTokens(next)
          setTokens(next)
          return await call(next.access_token)
        } catch (retryError) {
          if (retryError instanceof ApiError && retryError.status === 401) {
            writeTokens(null)
            setTokens(null)
            setUser(null)
            setStatus('signed-out')
          }
          throw retryError
        }
      }
    },
    [tokens],
  )

  const value = useMemo(() => ({ status, user, signIn, signOut, withAuth }), [status, user, signIn, signOut, withAuth])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession은 SessionProvider 안에서만 쓸 수 있어요.')
  return ctx
}
