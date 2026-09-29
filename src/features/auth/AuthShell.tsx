import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { SignupDraftProvider } from '../../auth/signupDraft'
import './AuthShell.css'

export type AuthMode = 'login' | 'signup' | 'login-full' | 'signup-full'

/** /auth 자체(예전 "접힌 시작 화면")는 디자인에서 빠졌다 → null이면 랜딩으로 */
function modeFor(pathname: string): AuthMode | null {
  if (pathname.startsWith('/auth/signup/')) return 'signup-full'
  if (pathname === '/auth/signup') return 'signup'
  if (pathname === '/auth/login' || pathname === '/auth/callback') return 'login'
  if (pathname.startsWith('/auth/find-id') || pathname.startsWith('/auth/reset-password')) return 'login-full'
  return null
}

const CLOSE_MS = 380

// Figma 1215:2403 로그인 및 회원가입 — 지금 보고 있는 페이지(랜딩) 위에 모달처럼 오른쪽에서 패널이 밀려 나온다.
// 패널은 로그인·회원가입이 같은 흰 패널이고, 손잡이 색만 다르다. 바깥(뒤 페이지)이나 손잡이를 누르면 닫힌다.
export function AuthShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const mode = modeFor(pathname)
  // 로그인·회원가입 첫 단계에서만 닫을 수 있다 (사용자 유형·계정 인증 등 이어지는 단계는 패널이 화면을 채운다)
  const closable = mode === 'login' || mode === 'signup'

  const close = () => {
    if (closing) return
    setClosing(true)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(() => navigate('/'), reduce ? 0 : CLOSE_MS)
  }

  // Esc로 닫기
  useEffect(() => {
    if (!closable) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!mode) return <Navigate to="/" replace />
  const kind = mode.startsWith('signup') ? 'signup' : 'login'

  return (
    <SignupDraftProvider>
      <div className="auth" data-mode={mode} data-closing={closing || undefined}>
        {/* 뒤 페이지를 살짝 가리는 막. 누르면 패널이 닫힌다 */}
        <div className="auth__scrim" onClick={closable ? close : undefined} aria-hidden="true" />

        <section className="auth__panel" data-kind={kind} role="dialog" aria-modal="true" aria-label={kind === 'login' ? '로그인' : '회원가입'}>
          {closable && (
            <button type="button" className="auth__handle" onClick={close}>
              <span className="visually-hidden">패널 닫기</span>
            </button>
          )}
          {/* 로그인 ↔ 회원가입을 오갈 때 내용만 다시 나타나게 한다 */}
          <div className="auth__content" key={kind}>
            <Outlet />
          </div>
        </section>
      </div>
    </SignupDraftProvider>
  )
}
