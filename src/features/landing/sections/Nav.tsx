import { useState } from 'react'
import { useMotionValueEvent, useScroll } from 'motion/react'
import { Link } from 'react-router-dom'
import { useSession } from '../../../auth/session'
import { Logo } from '../components/Logo'

const LINKS = [
  { href: '#top', label: '개요' },
  { href: '#about', label: '소개' },
  { href: '#story', label: '작동 방식' },
  { href: '#features', label: '기능' },
  { href: '#start', label: '시작하기' },
  // { href: '#voices', label: '후기' }, // 후기 섹션 재개 시 복구
]

export function Nav() {
  const { scrollY } = useScroll()
  const signedIn = useSession().status === 'signed-in'
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)

  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0
    setScrolled(y > 24)
    // 아래로 스크롤하면 숨기고, 위로 올리면 다시 노출
    setHidden(y > 600 && y > prev + 2)
  })

  return (
    <header className="nav" data-scrolled={scrolled} data-hidden={hidden}>
      <a href="#top" className="nav__brand" aria-label="Prolog 홈">
        <Logo />
        <span>prolog</span>
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
          <Link to="/projects" className="lbtn lbtn--ink lbtn--sm">
            내 프로젝트
          </Link>
        ) : (
          <>
            <Link to="/auth/login" className="nav__login">
              로그인
            </Link>
            <Link to="/auth/signup" className="lbtn lbtn--ink lbtn--sm">
              회원가입
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
