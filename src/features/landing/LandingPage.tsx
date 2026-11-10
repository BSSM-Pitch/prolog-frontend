import { useEffect } from 'react'
import { VOICE } from '../../content/voice'
import { useLenis } from './hooks/useLenis'
import { Features } from './sections/Features'
import { Footer } from './sections/Footer'
import { Nav } from './sections/Nav'
import { Problems } from './sections/Problems'
import { Statement } from './sections/Statement'
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

// 랜딩: 문구 → 쓰기 전의 문제점 → 기능 정리 → footer. 그림은 모두 펜선(roughjs)으로 직접 그린다.
export function LandingPage() {
  useLenis()
  useLandingHead()
  return (
    <div className="lp">
      <Nav />
      <main>
        <Statement />
        <Problems />
        <Features />
      </main>
      <Footer />
    </div>
  )
}
