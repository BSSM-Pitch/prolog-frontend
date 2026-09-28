import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import type { OAuthProvider } from '../../api/types'
import { useSignupDraft } from '../../auth/signupDraft'
import { Button } from '../../components/Button'
import { SocialButtons } from '../../components/SocialButtons'
import { TextField } from '../../components/TextField'
import { describeError } from '../../lib/errors'
import { validateConfirm, validateEmail, validatePassword, validateUsername } from '../../lib/validation'

type Field = 'username' | 'email' | 'password' | 'confirm'
type Errors = Partial<Record<Field, string>>

// Figma 1214:2072 회원가입
export function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const { draft, update } = useSignupDraft()

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

  // 소셜 가입은 비밀번호·이메일 대신 공급자 계정을 쓴다. 명세상 신규 소셜 가입에도 아이디는 필요하다.
  async function onSocial(provider: OAuthProvider) {
    setFormError(null)
    const usernameError = validateUsername(username)
    setErrors(usernameError ? { username: `${usernameError} 소셜 가입에도 아이디가 필요해요.` } : {})
    if (usernameError) return

    setBusy(true)
    try {
      if (!(await ensureUsernameAvailable())) return
      update({ username: username.trim(), email: '', password: '', provider })
      navigate('/auth/signup/role')
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
      {formError && (
        <p className="notice notice--error" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" block busy={busy}>
        {busy ? '확인 중…' : '회원가입'}
      </Button>
      <Link className="text-link auth-form__link" to="/auth/login">
        이미 계정이 있으신가요?
      </Link>
      <SocialButtons mode="signup" onSelect={onSocial} disabled={busy} />
    </form>
  )
}
