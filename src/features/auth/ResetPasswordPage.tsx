import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { useCountdown } from '../../lib/useCountdown'
import { describeError, errorCode } from '../../lib/errors'
import { CODE_RULE, validateConfirm, validatePassword } from '../../lib/validation'

// Figma 840:457 비밀번호 재설정 / 1214:2353 비밀번호 재설정 오류
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialLoginId = (location.state as { loginId?: string } | null)?.loginId ?? ''
  const timer = useCountdown()

  const [loginId, setLoginId] = useState(initialLoginId)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loginIdError, setLoginIdError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [sendNotice, setSendNotice] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const sent = timer.started

  async function onSend() {
    if (!loginId.trim()) {
      setLoginIdError('아이디 또는 이메일을 입력해 주세요.')
      return
    }
    setSending(true)
    setLoginIdError(null)
    setCodeError(null)
    try {
      const { expires_in } = await authApi.requestPasswordReset(loginId.trim())
      timer.start(expires_in)
      setCode('')
      setSendNotice('가입된 계정이면 등록된 이메일로 인증 코드를 보냈어요.')
    } catch (err) {
      setLoginIdError(errorCode(err) === 'SOCIAL_ONLY_ACCOUNT' ? '소셜 로그인으로 가입한 계정이에요. 비밀번호 없이 Google·네이버로 로그인해 주세요.' : describeError(err))
    } finally {
      setSending(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const c = !sent ? '먼저 인증 코드를 받아 주세요.' : timer.expired ? '인증 시간이 지났어요. 인증 코드를 다시 받아 주세요.' : CODE_RULE.test(code) ? null : '6자리 인증 코드를 입력해 주세요.'
    const p = validatePassword(password) ?? validateConfirm(password, confirm)
    setCodeError(c)
    setPasswordError(p)
    if (c || p) return

    setSubmitting(true)
    try {
      await authApi.resetPassword({ login_id: loginId.trim(), code, new_password: password })
      navigate('/auth/login', { replace: true, state: { notice: '비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.', loginId: loginId.trim() } })
    } catch (err) {
      const k = errorCode(err)
      if (k === 'VERIFICATION_CODE_INVALID' || k === 'VERIFICATION_CODE_EXPIRED') setCodeError('인증 코드가 일치하지 않아요. 코드를 확인하거나 다시 받아 주세요.')
      else setPasswordError(describeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-card auth-card--bordered" onSubmit={onSubmit} noValidate>
      <h1 className="auth-card__title">비밀번호 재설정</h1>
      <p className="auth-card__desc">새 비밀번호를 설정하세요.</p>
      <TextField
        label="아이디 또는 이메일"
        value={loginId}
        onChange={(v) => {
          setLoginId(v)
          setLoginIdError(null)
        }}
        error={loginIdError}
        success={!loginIdError ? sendNotice : null}
        autoComplete="username"
        placeholder="writer.kim@example.com"
        autoFocus={!initialLoginId}
      />
      {!sent && (
        <Button tone="ink" block onClick={onSend} busy={sending}>
          {sending ? '보내는 중…' : '인증 코드 받기'}
        </Button>
      )}
      <TextField
        variant="code"
        label="인증 코드"
        value={code}
        onChange={(v) => {
          setCode(v)
          setCodeError(null)
        }}
        error={codeError}
        hint={sent && !timer.expired ? `남은 시간 ${timer.label}` : undefined}
        disabled={!sent}
      />
      {sent && (
        <Button tone="outline" block onClick={onSend} busy={sending}>
          {sending ? '보내는 중…' : '인증 코드 재전송'}
        </Button>
      )}
      <TextField
        type="password"
        label="새 비밀번호 · 영문·숫자 포함 8자 이상"
        value={password}
        onChange={(v) => {
          setPassword(v)
          setPasswordError(null)
        }}
        invalid={Boolean(passwordError)}
        disabled={!sent}
        autoComplete="new-password"
      />
      <TextField
        type="password"
        label="새 비밀번호 확인"
        value={confirm}
        onChange={(v) => {
          setConfirm(v)
          setPasswordError(null)
        }}
        invalid={Boolean(passwordError)}
        disabled={!sent}
        autoComplete="new-password"
      />
      {passwordError && (
        <p className="notice notice--error notice--block" role="alert">
          {passwordError}
        </p>
      )}
      <Button type="submit" block busy={submitting} disabled={!sent}>
        {submitting ? '변경 중…' : '비밀번호 변경'}
      </Button>
      <Link className="text-link auth-form__link" to="/auth/login">
        로그인으로 돌아가기
      </Link>
    </form>
  )
}
