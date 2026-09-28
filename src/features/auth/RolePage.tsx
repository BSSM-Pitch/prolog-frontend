import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { useSession } from '../../auth/session'
import { takeReturnTo } from '../../lib/returnTo'
import { useSignupDraft } from '../../auth/signupDraft'
import { Button } from '../../components/Button'
import { RoleGroup } from '../../components/RoleOption'
import { describeError, errorCode } from '../../lib/errors'

// Figma 840:176 사용자 유형 선택
export function RolePage() {
  const navigate = useNavigate()
  const { signIn } = useSession()
  const { draft, update, clear } = useSignupDraft()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // 새로고침 등으로 가입 입력값이 사라졌으면 처음부터
  if (!draft.username) return <Navigate to="/auth/signup" replace />

  async function onConfirm() {
    if (!draft.signupTicket) {
      navigate('/auth/signup/verify')
      return
    }
    // 소셜 가입(AUTH v0.2): 공급자가 계정을 확인했으니 가입 티켓 + 아이디 + 유형으로 바로 가입한다.
    setBusy(true)
    setError(null)
    try {
      const result = await authApi.completeSocialSignup(draft.signupTicket, draft.username, draft.role)
      clear()
      signIn(result)
      navigate(takeReturnTo(), { replace: true })
    } catch (err) {
      const code = errorCode(err)
      setError(
        code === 'USERNAME_TAKEN'
          ? '그사이 다른 사람이 이 아이디를 가져갔어요. 이전으로 돌아가 아이디를 바꿔 주세요.'
          : code === 'SIGNUP_TICKET_INVALID'
            ? '가입 시간이 지났어요(10분). 로그인 화면에서 다시 소셜 로그인해 주세요.'
            : describeError(err),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-card">
      <h1 id="role-title" className="auth-card__title">
        사용자 유형
      </h1>
      <p className="auth-card__desc">서비스를 사용하시는 목적이 무엇인가요?</p>
      <RoleGroup value={draft.role} onChange={(role) => update({ role })} labelledBy="role-title" />
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="auth-card__row">
        <Button tone="outline" onClick={() => navigate('/auth/signup')}>
          이전
        </Button>
        <Button className="btn--grow-3" onClick={onConfirm} busy={busy}>
          {busy ? '가입 중…' : '선택 완료'}
        </Button>
      </div>
    </div>
  )
}
