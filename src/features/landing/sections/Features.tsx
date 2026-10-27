import { useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, type MotionValue, motion, useMotionValueEvent, useTransform } from 'motion/react'
import { useSectionProgress } from '../hooks/useSectionProgress'
import { Character, Conflict, Collab } from './FeatureVisuals'
import { VOICE } from '../../../content/voice'

/**
 * 레퍼런스
 * - Apple "Get to know" 갤러리: 고정 헤더 + 가로 트랙, 중앙 카드만 또렷하게
 * - Linear / Raycast 기능 카드: 아이콘 대신 실제 제품 UI 조각으로 설명
 * 카드 배경은 프라이머리 팔레트 스와치. 기능은 기획서 6장 핵심 기능 기준.
 */
const CARDS = [
  { hex: 'var(--ink)', tone: 'dark', ...VOICE.tools.character, Visual: Character },
  { hex: 'var(--sky)', tone: 'light', ...VOICE.tools.conflict, Visual: Conflict },
  { hex: 'var(--c50)', tone: 'light', ...VOICE.tools.collab, Visual: Collab },
] as const

const N = CARDS.length

function Segment({ i, progress }: { i: number; progress: MotionValue<number> }) {
  const scaleX = useTransform(progress, (v) => Math.min(1, Math.max(0, v * N - i)))
  return (
    <span className="fx-seg">
      <motion.i style={{ scaleX }} />
    </span>
  )
}

export function Features() {
  const ref = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [distance, setDistance] = useState(0)
  const [active, setActive] = useState(0)

  // 트랙 폭을 측정해 가로 이동 거리 = 섹션 추가 높이로 사용 (자연스러운 속도)
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => setDistance(Math.max(0, track.scrollWidth - window.innerWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const p = useSectionProgress(ref)
  const x = useTransform(p, [0, 1], [0, -distance])
  useMotionValueEvent(p, 'change', (v) => setActive(Math.min(N - 1, Math.round(v * (N - 1)))))

  return (
    <section ref={ref} className="features" id="features" style={{ height: `calc(${distance * 1.15}px + 100vh)` }}>
      <div className="features__sticky">
        <header className="fx-head">
          <div>
            <h2>{VOICE.tools.title}</h2>
          </div>
          <div className="fx-meta">
            <div className="fx-count" aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={active}
                  initial={{ y: '100%', opacity: 0 }}
                  animate={{ y: '0%', opacity: 1 }}
                  exit={{ y: '-100%', opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  0{active + 1}
                </motion.span>
              </AnimatePresence>
              <small>/ 0{N}</small>
            </div>
            <div className="fx-segs" aria-hidden="true">
              {CARDS.map((c, i) => (
                <Segment key={c.hex} i={i} progress={p} />
              ))}
            </div>
          </div>
        </header>

        <motion.div ref={trackRef} className="fx-track" style={{ x }}>
          {CARDS.map(({ Visual, ...c }, i) => (
            <article
              key={c.hex}
              className={`fcard fcard--${c.tone}`}
              style={{ background: c.hex }}
              data-active={active === i}
            >
              <div className="fcard__visual" role="img" aria-label={`${c.title} 예시`}>
                <Visual active={active === i} />
              </div>
              <div className="fcard__meta">
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
