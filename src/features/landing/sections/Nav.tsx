import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../../auth/session'
import { Logo } from '../../../components/Logo'

const LINKS = [
  { href: '#about', label: 'About' },
  { href: '#features', label: 'Features' },
  { href: '#process', label: 'Process' },
  { href: '#start', label: 'Start' },
]

export function Nav() {
  const signedIn = useSession().status === 'signed-in'
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="nav" data-scrolled={scrolled}>
      <div className="nav__inner">
        <a href="#top" className="nav__brand" aria-label="Prolog 홈">
          <Logo />
        </a>
        <nav className="nav__links" aria-label="주요 메뉴">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="nav__auth">
          {signedIn ? (
            <Link to="/projects" className="btn btn--ink">
              내 프로젝트
            </Link>
          ) : (
            <>
              <Link to="/auth/login" className="nav__login">
                로그인
              </Link>
              <Link to="/auth/signup" className="btn btn--ink">
                시작하기
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
