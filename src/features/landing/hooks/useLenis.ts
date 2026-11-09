import { useEffect } from 'react'
import Lenis from 'lenis'

let current: Lenis | null = null

/** 문서의 y 위치로 부드럽게 이동한다. Lenis가 꺼져 있으면(모션 감소) 바로 이동한다 */
export function scrollToY(y: number) {
  if (current) current.scrollTo(y, { duration: 1.2 })
  else window.scrollTo({ top: y })
}

/** 관성 스크롤. 모션 감소 설정 사용자에게는 적용하지 않는다. */
export function useLenis() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9 })
    current = lenis
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
      current = null
    }
  }, [])
}
