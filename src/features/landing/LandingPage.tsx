import { Link } from 'react-router-dom'
import './landing.css'

// 랜딩 페이지 — 디자인 확정 전 임시 뼈대 (Figma 1289:3388 랜딩 섹션 작업 중)
// 시연 흐름에는 넣지 않도록 `/landing`에만 두고 어디에서도 링크하지 않는다.
// 디자인이 나오면 섹션 내용을 채운 뒤 `/` 경로를 이 페이지로 바꾼다.

const FEATURES = [
  { title: 'AI 원고 질문', body: '원고 범위를 정해 묻고, 근거 장면과 함께 답을 받아요.' },
  { title: '캐릭터 설계', body: '자연어로 인물을 설명하면 구조화된 초안으로 정리해요.' },
  { title: '관계 변화', body: '장마다 달라지는 인물 사이의 관계를 한눈에 따라가요.' },
  { title: '복선 추적', body: '설치한 복선과 회수 시점을 놓치지 않게 기록해요.' },
  { title: '스토리 지도', body: '막 구조와 사건의 인과를 지도로 살펴봐요.' },
  { title: '설정 충돌 검토', body: '세계관 규칙과 어긋나는 문장을 찾아 알려 줘요.' },
]

export function LandingPage() {
  return (
    <div className="landing">
      <p className="landing__draft" role="note">
        임시 랜딩 페이지 · 디자인 확정 전이라 구성만 잡아 두었어요
      </p>

      <header className="landing__nav">
        <span className="landing__logo">Prolog</span>
        <nav className="landing__nav-links" aria-label="랜딩 메뉴">
          <a href="#features">기능</a>
          <a href="#start">시작하기</a>
          <Link className="btn btn--outline" to="/auth/login">
            로그인
          </Link>
        </nav>
      </header>

      <main>
        <section className="landing__hero" aria-labelledby="landing-title">
          <p className="landing__eyebrow">이야기의 시작부터 완성까지</p>
          <h1 id="landing-title" className="landing__title">
            긴 이야기를 끝까지
            <br />
            흔들림 없이 쓰도록
          </h1>
          <p className="landing__lead">원고, 인물, 관계, 복선, 세계관을 한곳에서 관리하는 장편 집필 도구</p>
          <div className="landing__cta">
            <Link className="btn btn--primary" to="/auth/signup">
              무료로 시작하기
            </Link>
            <a className="btn btn--outline" href="#features">
              기능 살펴보기
            </a>
          </div>
          <Placeholder label="대표 화면 이미지" tall />
        </section>

        <section id="features" className="landing__section" aria-labelledby="features-title">
          <h2 id="features-title" className="landing__heading">
            작가에게 필요한 도구
          </h2>
          <ul className="landing__features">
            {FEATURES.map((f) => (
              <li key={f.title} className="landing__feature">
                <Placeholder label="아이콘 · 미리보기" />
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing__section" aria-labelledby="flow-title">
          <h2 id="flow-title" className="landing__heading">
            작업 흐름
          </h2>
          <Placeholder label="원고 업로드 → AI 분석 → 검토·설계 흐름 소개" tall />
        </section>

        <section id="start" className="landing__section landing__final" aria-labelledby="start-title">
          <h2 id="start-title" className="landing__heading">
            지금 첫 장을 올려 보세요
          </h2>
          <p className="landing__lead">혼자 쓰는 작품도, 팀과 함께 쓰는 작품도 시작할 수 있어요.</p>
          <div className="landing__cta">
            <Link className="btn btn--primary" to="/auth/signup">
              회원가입
            </Link>
            <Link className="btn btn--outline" to="/auth/login">
              로그인
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing__footer">
        <span>© Prolog · BSSM Pitch</span>
      </footer>
    </div>
  )
}

/** 디자인이 들어갈 자리 */
function Placeholder({ label, tall }: { label: string; tall?: boolean }) {
  return (
    <div className={tall ? 'landing__placeholder landing__placeholder--tall' : 'landing__placeholder'} aria-hidden="true">
      {label}
    </div>
  )
}
