import { useEffect } from 'react'
import { useLenis } from './hooks/useLenis'
import { Features } from './sections/Features'
import { Finale } from './sections/Finale'
import { Footer } from './sections/Footer'
import { Hero } from './sections/Hero'
import { Manifesto } from './sections/Manifesto'
import { Nav } from './sections/Nav'
import { Story } from './sections/Story'
// 수치 섹션: 실제 지표 확보 후 다시 활성화
// import { Stats } from './sections/Stats'
// 후기 섹션: 베타 테스터 후기 확보 후 다시 활성화
// import { Voices } from './sections/Voices'
import 'lenis/dist/lenis.css'
import './landing.css'

// 랜딩에서만 쓰는 웹폰트(본문 Pretendard, 코드 JetBrains Mono, 손글씨 Nanum Pen Script). 앱 화면에는 싣지 않는다
const FONT_LINKS = [
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Nanum+Pen+Script&display=swap',
]

function useLandingHead() {
  useEffect(() => {
    for (const href of FONT_LINKS) {
      if (document.querySelector(`link[href="${href}"]`)) continue
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.append(link)
    }
    const prevTitle = document.title
    document.title = 'Prolog — 생각이 글이 되는 곳'
    return () => {
      document.title = prevTitle
    }
  }, [])
}

// 랜딩 페이지 (디자인 팀 Prolog-landing). 스크롤에 따라 영상 프레임을 넘기는 섹션들로 이뤄져 있다.
// behind: 로그인·회원가입 패널이 위에 모달로 떠 있다 — 스크롤과 포커스를 막는다
export function LandingPage({ behind = false }: { behind?: boolean }) {
  useLenis(behind)
  useLandingHead()
  return (
    <div className="lp" inert={behind} aria-hidden={behind || undefined}>
      <Nav />
      <main>
        <Hero />
        <Manifesto />
        <Story />
        <Features />
        {/* <Stats /> */}
        {/* <Voices /> */}
        <Finale />
      </main>
      <Footer />
    </div>
  )
}
