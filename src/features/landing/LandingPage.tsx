import { useEffect } from 'react'
import { VOICE } from '../../content/voice'
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

function useLandingHead() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = VOICE.title
    return () => {
      document.title = prevTitle
    }
  }, [])
}

// 랜딩 페이지 (디자인 팀 Prolog-landing). 스크롤에 따라 영상 프레임을 넘기는 섹션들로 이뤄져 있다.
export function LandingPage() {
  useLenis()
  useLandingHead()
  return (
    <div className="lp">
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
