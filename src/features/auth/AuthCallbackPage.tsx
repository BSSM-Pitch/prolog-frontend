import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as authApi from '../../api/auth'
import type { OAuthProvider } from '../../api/types'
import { describeError } from '../../lib/errors'
import { PROVIDER_NAMES, useSocialLogin } from './useSocialLogin'

// real 모드 소셜 인가 후 돌아오는 곳.
// Google은 /auth/callback — code+state를 받아 프론트가 백엔드와 교환한다(프런트 주도).
// 카카오는 /auth/callback/kakao — 백엔드가 이미 교환을 끝내고 토큰(#프래그먼트) 또는 가입 티켓(쿼리)을 바로 실어 보낸다(백엔드 주도).
export function AuthCallbackPage({ provider }: { provider: OAuthProvider }) {
  const [params] = useSearchParams()
  const { finish, finishKakaoTokens, complete } = useSocialLogin()
  const name = PROVIDER_NAMES[provider]
  const [kakaoTokens] = useState(() => (provider === 'kakao' ? new URLSearchParams(window.location.hash.slice(1)) : null))
  // 주소만 보고 알 수 있는 실패는 처음부터 보여 준다
  const [error, setError] = useState<string | null>(() => {
    if (params.get('error')) return `${name} 로그인을 취소했거나 완료하지 못했어요.`
    if (provider === 'kakao') {
      return params.get('signup_ticket') || kakaoTokens?.get('access_token') ? null : `${name} 로그인을 취소했거나 완료하지 못했어요.`
    }
    if (!params.get('code')) return `${name} 로그인을 취소했거나 완료하지 못했어요.`
    if (!authApi.checkOAuthState(provider, params.get('state'))) return '로그인 요청을 확인하지 못했어요. 다시 시도해 주세요.'
    return null
  })
  const started = useRef(false)

  useEffect(() => {
    if (started.current || error) return
    started.current = true
    if (provider === 'kakao') {
      const signupTicket = params.get('signup_ticket')
      const promise = signupTicket
        ? complete('kakao', { kind: 'signup', signup_ticket: signupTicket, email: params.get('email') })
        : finishKakaoTokens({
            access_token: kakaoTokens!.get('access_token')!,
            refresh_token: kakaoTokens!.get('refresh_token')!,
            expires_in: Number(kakaoTokens!.get('expires_in')),
          })
      promise.catch((e) => setError(describeError(e)))
      return
    }
    // 인가 코드는 1회용이라 StrictMode의 두 번째 실행에서 다시 쓰지 않는다
    finish(provider, params.get('code')!).catch((e) => setError(describeError(e)))
  }, [params, finish, finishKakaoTokens, complete, error, provider, kakaoTokens])

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
