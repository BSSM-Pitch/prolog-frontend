import { Logo } from '../../../components/Logo'

const COLS = [
  { title: 'Product', links: ['기능', '요금제', '업데이트'] },
  { title: 'Company', links: ['소개', '채용', '블로그'] },
  { title: 'Support', links: ['도움말', '개인정보처리방침', '이용약관'] },
]

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__brand">
          <Logo />
          <p className="t-body">생각이 글이 되는 곳.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title} className="footer__col">
            <p className="eyebrow">{c.title}</p>
            {c.links.map((l) => (
              <a key={l} href="#top">
                {l}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="footer__bottom">
        <span>© 2026 Prolog Labs.</span>
        <span>Cloud photos · Unsplash</span>
      </div>
    </footer>
  )
}
