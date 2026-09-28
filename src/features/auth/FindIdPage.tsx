import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { describeError, errorCode } from '../../lib/errors'
import { validateEmail } from '../../lib/validation'

// Figma 840:433 아이디 찾기 / 1214:2224 아이디 찾기 결과
export function FindIdPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const n = name.trim() ? null : '이름을 입력해 주세요.'
    const m = validateEmail(email)
    setNameError(n)
    setEmailError(m)
    setError(null)
    setFound(null)
    if (n || m) return

    setBusy(true)
    try {
      const { username } = await authApi.findUsername(name.trim(), email.trim())
      setFound(username)
    } catch (err) {
      const c = errorCode(err)
      if (c === 'SOCIAL_ONLY_ACCOUNT') setError('Google이나 네이버로 가입한 이메일이에요. 로그인 화면에서 소셜 로그인을 이용해 주세요.')
      else if (c === 'USER_NOT_FOUND') setError('입력한 이름과 이메일로 가입된 계정이 없어요. 철자를 확인하거나 다른 이메일로 찾아 주세요.')
      else setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-card auth-card--bordered" onSubmit={onSubmit} noValidate>
      <h1 className="auth-card__title">아이디 찾기</h1>
      <p className="auth-card__desc">가입할 때 사용한 이름과 이메일을 입력하세요.</p>
      <TextField
        label="이름"
        value={name}
        onChange={(v) => {
          setName(v)
          setNameError(null)
        }}
        error={nameError}
        autoComplete="name"
        placeholder="김유진"
        autoFocus
      />
      <TextField
        type="email"
        label="가입 이메일"
        value={email}
        onChange={(v) => {
          setEmail(v)
          setEmailError(null)
        }}
        error={emailError}
        autoComplete="email"
        placeholder="writer.kim@example.com"
      />
      <Button type="submit" block busy={busy} style={found ? { opacity: 0.75 } : undefined}>
        {busy ? '찾는 중…' : '아이디 찾기'}
      </Button>

      {found ? (
        <>
          <p className="result-box" role="status">
            가입된 아이디 : {found}
          </p>
          <div className="auth-card__row">
            <Button onClick={() => navigate('/auth/login', { state: { loginId: found } })}>로그인으로 돌아가기</Button>
            <Button tone="outline" onClick={() => navigate('/auth/reset-password', { state: { loginId: found } })}>
              비밀번호 재설정
            </Button>
          </div>
        </>
      ) : (
        <>
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}
          <p className="auth-card__caption">Google·Naver로 가입했다면 소셜 로그인을 이용해주세요.</p>
          <Link className="text-link auth-form__link" to="/auth/login">
            로그인으로 돌아가기
          </Link>
        </>
      )}
    </form>
  )
}
