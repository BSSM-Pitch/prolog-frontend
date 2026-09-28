import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import type { OAuthProvider } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { SocialButtons } from '../../components/SocialButtons'
import { TextField } from '../../components/TextField'
import { describeError, errorCode, mockOAuthCode } from '../../lib/errors'

interface LoginLocationState {
  notice?: string
  loginId?: string
}

// Figma 1173:2382 로그인 / 1214:2175 로그인 오류
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as LoginLocationState
  const { signIn } = useSession()

  const [loginId, setLoginId] = useState(state.loginId ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!loginId.trim() || !password) {
      setError('아이디(또는 이메일)와 비밀번호를 모두 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      signIn(await authApi.login(loginId.trim(), password))
      navigate('/projects', { replace: true })
    } catch (err) {
      setError(errorCode(err) === 'INVALID_CREDENTIALS' ? '아이디 또는 비밀번호가 올바르지 않습니다. 다시 확인해 주세요.' : describeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function onSocial(provider: OAuthProvider) {
    setBusy(true)
    setError(null)
    try {
      signIn(await authApi.oauthLogin(provider, { oauth_code: mockOAuthCode(provider) }))
      navigate('/projects', { replace: true })
    } catch (err) {
      if (errorCode(err) === 'USERNAME_REQUIRED') {
        navigate('/auth/signup', { state: { notice: `${provider === 'google' ? 'Google' : '네이버'} 계정이 아직 가입되지 않았어요. 아이디를 정하고 다시 눌러 주세요.` } })
        return
      }
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  function clearError() {
    if (error) setError(null)
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <h1 className="auth-form__title">로그인</h1>
      {state.notice && !error && (
        <p className="notice notice--success" role="status">
          {state.notice}
        </p>
      )}
      <TextField
        size="lg"
        label="아이디 또는 이메일"
        value={loginId}
        onChange={(v) => {
          setLoginId(v)
          clearError()
        }}
        autoComplete="username"
        placeholder="writer.kim@example.com"
        autoFocus
      />
      <TextField
        size="lg"
        type="password"
        label="비밀번호"
        value={password}
        onChange={(v) => {
          setPassword(v)
          clearError()
        }}
        autoComplete="current-password"
        error={error}
      />
      <Button type="submit" size="lg" block tone={error ? 'error' : 'primary'} busy={busy}>
        {busy ? '로그인 중…' : '로그인'}
      </Button>
      <Link className="text-link auth-form__link" to="/auth/find-id">
        계정 복구
      </Link>
      <SocialButtons mode="login" onSelect={onSocial} disabled={busy} />
    </form>
  )
}
