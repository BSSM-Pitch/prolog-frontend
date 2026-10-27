import { useState } from 'react'
import { useMotionValueEvent, useScroll } from 'motion/react'
import { Link } from 'react-router-dom'
import { useSession } from '../../../auth/session'
import { Logo } from '../components/Logo'
import { VOICE } from '../../../content/voice'

export function Nav() {
  const { scrollY } = useScroll()
  const signedIn = useSession().status === 'signed-in'
  const [hidden, setHidden] = useState(false)

  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0
    // 아래로 스크롤하면 숨기고, 위로 올리면 다시 노출
    setHidden(y > 600 && y > prev + 2)
  })

  return (
    <header className="nav" data-hidden={hidden}>
      <a href="#top" className="nav__brand" aria-label="Prolog 홈">
        <Logo />
        <span>prolog</span>
      </a>
      <nav className="nav__links" aria-label="주요 메뉴">
        {VOICE.navigation.map((l) => (
          <a key={l.href} href={l.href}>
            {l.label}
          </a>
        ))}
      </nav>
      <div className="nav__auth">
        {signedIn ? (
          <Link to="/projects" className="lbtn lbtn--ink lbtn--sm">
            {VOICE.cta.library}
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
