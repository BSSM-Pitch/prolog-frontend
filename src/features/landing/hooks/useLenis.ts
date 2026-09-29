import { useEffect, useRef } from 'react'
import Lenis from 'lenis'

/**
 * 관성 스크롤. 모션 감소 설정 사용자에게는 적용하지 않는다.
 * paused면 스크롤을 멈춘다 — 로그인·회원가입 패널이 랜딩 위에 모달로 떠 있을 때
 */
export function useLenis(paused = false) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9 })
    lenisRef.current = lenis
    let id = 0
    const raf = (t: number) => {
      lenis.raf(t)
      id = requestAnimationFrame(raf)
    }
    id = requestAnimationFrame(raf)

    // 앵커 링크를 Lenis로 부드럽게 이동
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
      if (!a) return
      const el = document.querySelector(a.getAttribute('href')!)
      if (!el) return
      e.preventDefault()
      lenis.scrollTo(el as HTMLElement, { duration: 1.6 })
    }
    document.addEventListener('click', onClick)

    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('click', onClick)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  // 모달이 떠 있는 동안 뒤 페이지가 스크롤되지 않게 한다
  useEffect(() => {
    if (!paused) return
    const root = document.documentElement
    const prev = root.style.overflow
    root.style.overflow = 'hidden'
    lenisRef.current?.stop()
    return () => {
      root.style.overflow = prev
      lenisRef.current?.start()
    }
  }, [paused])
}
