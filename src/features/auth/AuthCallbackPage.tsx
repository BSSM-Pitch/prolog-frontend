import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { describeError } from '../../lib/errors'
import { useSocialLogin } from './useSocialLogin'

// real 모드 Google 인가 후 돌아오는 곳 (백엔드 GOOGLE_REDIRECT_URI와 같은 주소)
export function AuthCallbackPage() {
  const [params] = useSearchParams()
  const { finish } = useSocialLogin()
  // 주소만 보고 알 수 있는 실패는 처음부터 보여 준다
  const [error, setError] = useState<string | null>(() => {
    if (params.get('error') || !params.get('code')) return 'Google 로그인을 취소했거나 완료하지 못했어요.'
    if (!authApi.checkGoogleState(params.get('state'))) return '로그인 요청을 확인하지 못했어요. 다시 시도해 주세요.'
    return null
  })
  const started = useRef(false)

  useEffect(() => {
    // 인가 코드는 1회용이라 StrictMode의 두 번째 실행에서 다시 쓰지 않는다
    const code = params.get('code')
    if (started.current || error || !code) return
    started.current = true
    finish('google', code).catch((e) => setError(describeError(e)))
  }, [params, finish, error])

  return (
    <div className="auth-form">
      <h1 className="auth-form__title">Google 로그인</h1>
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
