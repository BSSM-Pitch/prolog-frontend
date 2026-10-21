import { useEffect } from 'react'
import { useLenis } from './hooks/useLenis'
import { CtaBand } from './sections/CtaBand'
import { Features } from './sections/Features'
import { Footer } from './sections/Footer'
import { Hero } from './sections/Hero'
import { MadeFor } from './sections/MadeFor'
import { Nav } from './sections/Nav'
import { Process } from './sections/Process'
import { Promo } from './sections/Promo'
import 'lenis/dist/lenis.css'
import './landing.css'

function useLandingTitle() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Prolog — 생각이 글이 되는 곳'
    return () => {
      document.title = prevTitle
    }
  }, [])
}

// 랜딩 페이지. 구름 히어로 → 형식 바 → 기능 카드 → 3단계 → 베타 안내 → 구름 CTA 순서
// behind: 로그인·회원가입 패널이 위에 모달로 떠 있다 — 스크롤과 포커스를 막는다
export function LandingPage({ behind = false }: { behind?: boolean }) {
  useLenis(behind)
  useLandingTitle()
  return (
    <div className="lp" inert={behind} aria-hidden={behind || undefined}>
      <Nav />
      <main>
        <Hero />
        <MadeFor />
        <Features />
        <Process />
        <Promo />
        <CtaBand />
      </main>
      <Footer />
    </div>
  )
}
