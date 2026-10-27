import { Logo } from '../components/Logo'
import { VOICE } from '../../../content/voice'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__brand">
          <Logo size={36} />
          <p>당신의 다음 문장을 위해.</p>
        </div>
        <nav className="footer__col" aria-label="랜딩 목차">
          {VOICE.navigation.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="footer__bottom">
        <span>© 2026 Prolog.</span>
      </div>
    </footer>
  )
}
