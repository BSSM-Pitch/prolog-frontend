import { useState } from 'react'
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

// Figma 1215:2403 로그인 및 회원가입 — 랜딩의 로그인·회원가입을 누르면 오른쪽에서 패널이 밀려 나온다.
// 패널은 로그인·회원가입이 같은 흰 패널이고, 손잡이 색만 다르다.
export function AuthShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const mode = modeFor(pathname)
  if (!mode) return <Navigate to="/" replace />

  const kind = mode.startsWith('signup') ? 'signup' : 'login'
  // 로그인·회원가입 첫 단계에서는 브랜드 영역이나 패널 손잡이를 눌러 패널을 닫고 랜딩으로 돌아간다
  const closable = mode === 'login' || mode === 'signup'
  const close = () => {
    if (closing) return
    setClosing(true)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(() => navigate('/'), reduce ? 0 : CLOSE_MS)
  }

  const brand = (
    <>
      <span className="brand__title">Prolog</span>
      <span className="brand__tagline">이야기의 시작부터 완성까지</span>
    </>
  )

  return (
    <SignupDraftProvider>
      <div className="auth" data-mode={mode} data-closing={closing || undefined}>
        {closable ? (
          <button type="button" className="auth__brand auth__brand--button" onClick={close} aria-label="패널 닫고 처음 화면으로">
            {brand}
          </button>
        ) : (
          <div className="auth__brand" aria-hidden="true">
            {brand}
          </div>
        )}

        <section className="auth__panel" data-kind={kind} aria-label={kind === 'login' ? '로그인' : '회원가입'}>
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
