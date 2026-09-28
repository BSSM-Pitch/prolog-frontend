import { Logo } from '../components/Logo'

const COLS = [
  { title: '제품', links: ['기능', '요금제', '업데이트', '다운로드'] },
  { title: '회사', links: ['소개', '채용', '블로그', '보도자료'] },
  { title: '지원', links: ['도움말', '커뮤니티', '개인정보처리방침', '이용약관'] },
]

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__brand">
          <Logo size={36} />
          <p>생각이 글이 되는 곳.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title} className="footer__col">
            <p className="mono">{c.title}</p>
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
      </div>
    </footer>
  )
}
