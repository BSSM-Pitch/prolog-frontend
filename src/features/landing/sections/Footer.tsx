import { Link } from 'react-router-dom'
import { useSession } from '../../../auth/session'
import { VOICE } from '../../../content/voice'
import { Figure, Strokes } from '../components/ink/Figure'
import { fountainPen, ink } from '../components/ink/rough'
import { Logo } from '../components/Logo'

// 마감 문장 아래로 길게 그은 펜선. 끝에 펜촉이 놓인다
const rule = [ink.line(4, 62, 1040, 60, { strokeWidth: 2, roughness: 0.8, bowing: 2 })]
const nib = fountainPen(0.5)

/** 4. Footer: 마지막 권유와 사이트 정보 */
export function Footer() {
  const signedIn = useSession().status === 'signed-in'
  const { title, body, tagline } = VOICE.closing

  return (
    <footer className="footer" id="start">
      <div className="footer__cta">
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="footer__actions">
          {signedIn ? (
            <Link to="/projects" className="lbtn lbtn--ink">
              {VOICE.cta.resume}
            </Link>
          ) : (
            <>
              <Link to="/auth/signup" className="lbtn lbtn--ink">
                {VOICE.cta.start}
              </Link>
              <Link to="/auth/login" className="ink-link">
                로그인
              </Link>
            </>
          )}
        </div>
      </div>
      <Figure w={1200} h={100} className="footer__rule" amount={0.8}>
        <Strokes shapes={rule} duration={1.6} />
        <Strokes shapes={nib} delay={1.4} step={0.06} duration={0.4} transform="translate(1040 60) rotate(-18)" />
      </Figure>
      <div className="footer__bottom">
        <div className="footer__brand">
          <Logo size={26} />
          <span>{tagline}</span>
        </div>
        <nav className="footer__links" aria-label="랜딩 목차">
          {VOICE.navigation.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <small>© 2026 Prolog.</small>
      </div>
    </footer>
  )
}
