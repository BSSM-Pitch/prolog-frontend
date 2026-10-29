import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { SignupDraftProvider } from '../../auth/signupDraft'
import { Logo } from '../landing/components/Logo'
import './AuthShell.css'

export type AuthMode = 'login' | 'signup' | 'login-full' | 'signup-full'

/** /auth 자체는 시작 화면이 없다 → null이면 랜딩으로 */
function modeFor(pathname: string): AuthMode | null {
  if (pathname.startsWith('/auth/signup/')) return 'signup-full'
  if (pathname === '/auth/signup') return 'signup'
  if (pathname === '/auth/login' || pathname === '/auth/callback') return 'login'
  if (pathname.startsWith('/auth/find-id') || pathname.startsWith('/auth/reset-password')) return 'login-full'
  return null
}

// 로그인·회원가입은 랜딩과 떨어진 전체화면 페이지다. 상단 바 아래 가운데에 폼이 놓인다.
export function AuthShell() {
  const { pathname } = useLocation()
  const mode = modeFor(pathname)
  if (!mode) return <Navigate to="/" replace />
  const kind = mode.startsWith('signup') ? 'signup' : 'login'

  return (
    <SignupDraftProvider>
      <div className="auth" data-mode={mode}>
        <header className="auth__bar">
          <Link to="/" className="auth__brand" aria-label="Prolog 홈으로">
            <Logo size={26} />
            <span>prolog</span>
          </Link>
          {kind === 'login' ? (
            <Link to="/auth/signup" className="text-link auth__switch">
              회원가입
            </Link>
          ) : (
            <Link to="/auth/login" className="text-link auth__switch">
              로그인
            </Link>
          )}
        </header>

        {/* 로그인 ↔ 회원가입을 오갈 때 내용만 다시 나타난다 */}
        <main className="auth__page" data-kind={kind}>
          <div className="auth__content" key={kind}>
            <Outlet />
          </div>
        </main>
      </div>
    </SignupDraftProvider>
  )
}
