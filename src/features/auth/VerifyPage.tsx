import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { useSession } from '../../auth/session'
import { useSignupDraft } from '../../auth/signupDraft'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { useCountdown } from '../../lib/useCountdown'
import { describeError, errorCode } from '../../lib/errors'
import { CODE_RULE, validateEmail } from '../../lib/validation'

const CODE_MISMATCH = '인증 코드가 일치하지 않습니다. 코드를 확인해 주세요.\n시간이 만료되면 새 코드를 요청해 주세요.'

// Figma 840:360 계정 인증 / 1214:2144 계정 인증 오류
export function VerifyPage() {
  const navigate = useNavigate()
  const { signIn } = useSession()
  const { draft, update, clear } = useSignupDraft()
  const timer = useCountdown()

  const [code, setCode] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [usernameTaken, setUsernameTaken] = useState(false)
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!draft.username || !draft.password) return <Navigate to="/auth/signup" replace />

  const expired = timer.expired
  const message = codeError ?? (expired ? '인증 시간이 지났어요. 인증코드를 다시 받아 주세요.' : null)
  // Figma 1214:2144: 오류가 나면 코드를 고치기 전까지 가입 버튼을 비활성으로 둔다
  const canSubmit = timer.started && !expired && !codeError && CODE_RULE.test(code)

  async function onSend() {
    const invalid = validateEmail(draft.email)
    setEmailError(invalid)
    if (invalid) return
    setSending(true)
    setCodeError(null)
    try {
      const { expires_in } = await authApi.sendSignupCode(draft.email.trim())
      setCode('')
      timer.start(expires_in)
    } catch (err) {
      setEmailError(errorCode(err) === 'EMAIL_TAKEN' ? '이미 가입된 이메일이에요. 로그인하거나 다른 이메일을 입력해 주세요.' : describeError(err))
    } finally {
      setSending(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const result = await authApi.signup({
        username: draft.username,
        email: draft.email.trim(),
        password: draft.password,
        role: draft.role,
        verification_code: code,
      })
      clear()
      signIn(result)
      navigate('/projects', { replace: true })
    } catch (err) {
      const c = errorCode(err)
      if (c === 'VERIFICATION_CODE_INVALID' || c === 'VERIFICATION_CODE_EXPIRED') setCodeError(CODE_MISMATCH)
      else if (c === 'USERNAME_TAKEN') {
        setUsernameTaken(true)
        setCodeError('그사이 다른 사람이 이 아이디를 가져갔어요. 회원가입으로 돌아가 아이디를 바꿔 주세요.')
      } else setCodeError(describeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const hasError = Boolean(message)

  return (
    // Figma 840:362 — 480 기준 카드를 1.2667배로 키운 디자인. 제목 / [설명 · 이메일 · 인증 코드] / 버튼, 묶음 사이 40
    <form className="auth-card auth-card--verify" onSubmit={onSubmit} noValidate>
      <h1 className="auth-card__title">계정 인증</h1>
      <div className="auth-card__group verify__body">
        <p className="auth-card__desc">이메일로 전송된 인증 코드를 입력하세요.</p>
        <div className="auth-card__group verify__fields">
          <div className="auth-card__group verify__block verify__email">
            <TextField
              type="email"
              label="이메일"
              value={draft.email}
              onChange={(email) => {
                update({ email })
                setEmailError(null)
              }}
              error={emailError}
              autoComplete="email"
            />
            <Button tone={hasError ? 'error' : 'outline-strong'} block onClick={onSend} busy={sending}>
              {sending ? '보내는 중…' : timer.started ? '인증코드 재전송' : '인증코드 전송'}
            </Button>
          </div>
          <div className="auth-card__group verify__block verify__code">
            <TextField
              variant="code"
              label="인증 코드"
              value={code}
              onChange={(v) => {
                setCode(v)
                setCodeError(null)
              }}
              disabled={!timer.started}
              invalid={hasError}
              placeholder={timer.started ? '6자리 숫자' : '먼저 인증코드를 받아 주세요'}
            />
            {hasError ? (
              <p className="notice notice--error notice--block" role="alert">
                {message}
              </p>
            ) : (
              timer.started && (
                <p className="auth-card__meta" aria-live="polite">
                  남은 시간 {timer.label}
                </p>
              )
            )}
          </div>
        </div>
      </div>
      <Button type="submit" block disabled={!canSubmit} busy={submitting}>
        {submitting ? '가입 중…' : '인증하고 가입 완료'}
      </Button>
      {usernameTaken && (
        <Link className="text-link auth-form__link" to="/auth/signup">
          회원가입으로 돌아가기
        </Link>
      )}
    </form>
  )
}
