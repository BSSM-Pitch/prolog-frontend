import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { IS_REAL } from '../../api/config'
import type { OAuthProvider } from '../../api/types'
import { useSignupDraft } from '../../auth/signupDraft'
import { Button } from '../../components/Button'
import { SocialButtons } from '../../components/SocialButtons'
import { TextField } from '../../components/TextField'
import { describeError } from '../../lib/errors'
import { validateConfirm, validateEmail, validatePassword, validateUsername } from '../../lib/validation'
import { useSocialLogin } from './useSocialLogin'

type Field = 'username' | 'email' | 'password' | 'confirm'
type Errors = Partial<Record<Field, string>>

// Figma 1214:2072 회원가입
export function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const { draft, update, clear } = useSignupDraft()
  const social = useSocialLogin()
  // 소셜 인증을 마치고 가입 티켓을 받았으면 아이디만 정하면 된다 (AUTH v0.2)
  const ticketMode = Boolean(draft.signupTicket)

  const [username, setUsername] = useState(draft.username)
  const [email, setEmail] = useState(draft.email)
  const [password, setPassword] = useState(draft.password)
  const [confirm, setConfirm] = useState(draft.password)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function set(field: Field, setter: (v: string) => void) {
    return (v: string) => {
      setter(v)
      if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
    }
  }

  /** 아이디 중복 확인. 사용 가능하면 true */
  async function ensureUsernameAvailable(): Promise<boolean> {
    const { available } = await authApi.checkUsername(username.trim())
    if (!available) setErrors((e) => ({ ...e, username: '이미 사용 중인 아이디예요. 다른 아이디를 입력해 주세요.' }))
    return available
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (ticketMode) return onTicketSubmit()
    if (IS_REAL) {
      setFormError('아이디·비밀번호 가입은 아직 지원하지 않아요. 아래 Google로 회원가입을 이용해 주세요.')
      return
    }
    const next: Errors = {
      username: validateUsername(username) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirm: validateConfirm(password, confirm) ?? undefined,
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setBusy(true)
    try {
      if (!(await ensureUsernameAvailable())) return
      update({ username: username.trim(), email: email.trim(), password, provider: null })
      navigate('/auth/signup/role')
    } catch (err) {
      setFormError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  /** 가입 티켓이 있을 때: 아이디만 확인하고 사용자 유형으로 */
  async function onTicketSubmit() {
    const usernameError = validateUsername(username)
    setErrors(usernameError ? { username: usernameError } : {})
    if (usernameError) return
    setBusy(true)
    try {
      if (!(await ensureUsernameAvailable())) return
      update({ username: username.trim() })
      navigate('/auth/signup/role')
    } catch (err) {
      setFormError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  // 소셜 가입(AUTH v0.2): 먼저 공급자 인증을 받고, 처음 연결한 계정이면 돌아와서 아이디를 정한다.
  async function onSocial(provider: OAuthProvider) {
    setFormError(null)
    setBusy(true)
    try {
      await social.start(provider)
    } catch (err) {
      setFormError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <h1 className="auth-form__title">회원가입</h1>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <TextField
        size="lg"
        label="아이디"
        value={username}
        onChange={set('username', setUsername)}
        error={errors.username}
        autoComplete="username"
        placeholder="침착맨"
        autoFocus
      />
      {ticketMode ? (
        <>
          {draft.email && <TextField size="lg" label="연결한 계정" value={draft.email} onChange={() => {}} disabled />}
          <button
            type="button"
            className="text-link auth-form__link"
            onClick={() => {
              clear()
              navigate('/auth/signup', { replace: true, state: null })
            }}
          >
            다른 방법으로 가입하기
          </button>
        </>
      ) : (
        <>
          <TextField
            size="lg"
            type="email"
            label="이메일"
            value={email}
            onChange={set('email', setEmail)}
            error={errors.email}
            autoComplete="email"
            placeholder="writer.kim@example.com"
          />
          <TextField
            size="lg"
            type="password"
            label="비밀번호"
            value={password}
            onChange={set('password', setPassword)}
            error={errors.password}
            autoComplete="new-password"
          />
          <TextField
            size="lg"
            type="password"
            label="비밀번호 확인"
            value={confirm}
            onChange={set('confirm', setConfirm)}
            error={errors.confirm}
            autoComplete="new-password"
          />
        </>
      )}
      {formError && (
        <p className="notice notice--error" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" block busy={busy}>
        {busy ? '확인 중…' : ticketMode ? '다음' : '회원가입'}
      </Button>
      <Link className="text-link auth-form__link" to="/auth/login">
        이미 계정이 있으신가요?
      </Link>
      {!ticketMode && <SocialButtons mode="signup" onSelect={onSocial} disabled={busy} />}
    </form>
  )
}
