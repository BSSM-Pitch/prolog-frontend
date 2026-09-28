import { useEffect, useRef } from 'react'
import { animate, useInView } from 'motion/react'

const STATS = [
  { value: 120000, suffix: '+', label: '매일 Prolog에서 쓰는 사람들', format: (n: number) => Math.round(n).toLocaleString('ko-KR') },
  { value: 3.2, suffix: '×', label: '초안 완성까지 빨라진 속도', format: (n: number) => n.toFixed(1) },
  { value: 98.7, suffix: '%', label: '한국어 받아쓰기 정확도', format: (n: number) => n.toFixed(1) },
]

function Counter({ value, suffix, format }: { value: number; suffix: string; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20% 0px' })
  useEffect(() => {
    if (!inView || !ref.current) return
    const el = ref.current
    const controls = animate(0, value, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => (el.textContent = format(n)),
    })
    return () => controls.stop()
  }, [inView, value, format])
  return (
    <p className="stat__num">
      <span ref={ref}>{format(0)}</span>
      <em>{suffix}</em>
    </p>
  )
}

export function Stats() {
  return (
    <section className="stats">
      {STATS.map((s) => (
        <div key={s.label} className="stat">
          <Counter {...s} />
          <p className="stat__label">{s.label}</p>
        </div>
      ))}
    </section>
  )
}
