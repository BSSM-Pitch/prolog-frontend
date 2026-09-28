import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { SignupDraftProvider } from '../../auth/signupDraft'
import './AuthShell.css'

export type AuthMode = 'start' | 'login' | 'signup' | 'login-full' | 'signup-full'

function modeFor(pathname: string): AuthMode {
  if (pathname.startsWith('/auth/signup/')) return 'signup-full'
  if (pathname === '/auth/signup') return 'signup'
  if (pathname === '/auth/login' || pathname === '/auth/callback') return 'login'
  if (pathname.startsWith('/auth/find-id') || pathname.startsWith('/auth/reset-password')) return 'login-full'
  return 'start'
}

export function AuthShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mode = modeFor(pathname)

  const loginOpen = mode === 'login' || mode === 'login-full'
  const signupOpen = mode === 'signup' || mode === 'signup-full'
  // 로그인·회원가입 패널이 펼쳐져 있을 때는 브랜드 영역이나 패널 손잡이를 눌러 시작 화면으로 접는다
  const collapsible = mode === 'login' || mode === 'signup'
  const close = () => navigate('/auth')

  const brand = (
    <>
      <span className="brand__title">Prolog</span>
      <span className="brand__tagline">이야기의 시작부터 완성까지</span>
    </>
  )

  return (
    <SignupDraftProvider>
      <div className="auth" data-mode={mode}>
        {collapsible ? (
          <button type="button" className="auth__brand auth__brand--button" onClick={close} aria-label="패널 접고 처음 화면으로">
            {brand}
          </button>
        ) : (
          <div className="auth__brand" aria-hidden={mode.endsWith('-full') || undefined}>
            {brand}
          </div>
        )}

        {/* 다른 패널에 완전히 가려진 패널은 포커스가 가지 않게 inert 처리 */}
        <section className="auth__panel auth__panel--login" aria-label="로그인" inert={mode === 'signup-full'}>
          {loginOpen ? (
            <>
              {mode === 'login' && <PanelHandle label="로그인 패널 접기" onClick={close} />}
              <div className="auth__content">
                <Outlet />
              </div>
            </>
          ) : (
            <button type="button" className="auth__tab" onClick={() => navigate('/auth/login')}>
              <span className="visually-hidden">로그인 열기</span>
            </button>
          )}
        </section>

        <section className="auth__panel auth__panel--signup" aria-label="회원가입" inert={mode === 'login-full'}>
          {signupOpen ? (
            <>
              {mode === 'signup' && <PanelHandle label="회원가입 패널 접기" onClick={close} />}
              <div className="auth__content">
                <Outlet />
              </div>
            </>
          ) : (
            <button type="button" className="auth__tab" onClick={() => navigate('/auth/signup')}>
              <span className="visually-hidden">회원가입 열기</span>
            </button>
          )}
        </section>
      </div>
    </SignupDraftProvider>
  )
}

/** 펼쳐진 패널의 왼쪽 가장자리(손잡이). 다시 누르면 패널이 접힌다. */
function PanelHandle({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="auth__handle" onClick={onClick}>
      <span className="visually-hidden">{label}</span>
    </button>
  )
}
