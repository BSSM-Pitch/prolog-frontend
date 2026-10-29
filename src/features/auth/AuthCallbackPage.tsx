import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as authApi from '../../api/auth'
import type { OAuthProvider } from '../../api/types'
import { describeError } from '../../lib/errors'
import { PROVIDER_NAMES, useSocialLogin } from './useSocialLogin'

// real 모드 소셜 인가 후 돌아오는 곳.
// Google은 /auth/callback(백엔드 GOOGLE_REDIRECT_URI와 같은 주소), 네이버는 /auth/callback/naver(네이버 개발자센터 Callback URL)
export function AuthCallbackPage({ provider }: { provider: OAuthProvider }) {
  const [params] = useSearchParams()
  const { finish } = useSocialLogin()
  const name = PROVIDER_NAMES[provider]
  // 주소만 보고 알 수 있는 실패는 처음부터 보여 준다
  const [error, setError] = useState<string | null>(() => {
    if (params.get('error') || !params.get('code')) return `${name} 로그인을 취소했거나 완료하지 못했어요.`
    if (!authApi.checkOAuthState(provider, params.get('state'))) return '로그인 요청을 확인하지 못했어요. 다시 시도해 주세요.'
    return null
  })
  const started = useRef(false)

  useEffect(() => {
    // 인가 코드는 1회용이라 StrictMode의 두 번째 실행에서 다시 쓰지 않는다
    const code = params.get('code')
    if (started.current || error || !code) return
    started.current = true
    finish(provider, code, params.get('state')).catch((e) => setError(describeError(e)))
  }, [params, finish, error, provider])

  return (
    <div className="auth-form">
      <h1 className="auth-form__title">{name} 로그인</h1>
      {error ? (
        <>
          <p className="notice notice--error" role="alert">
            {error}
          </p>
          <Link className="text-link auth-form__link" to="/auth/login">
            로그인으로 돌아가기
          </Link>
        </>
      ) : (
        <p className="notice" role="status">
          계정을 확인하고 있어요…
        </p>
      )}
    </div>
  )
}
