import { type PointerEvent, useLayoutEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  type MotionValue,
  motion,
  useMotionValueEvent,
  useTransform,
} from 'motion/react'
import { useSectionProgress } from '../hooks/useSectionProgress'
import { Character, Conflict, Relation, Foreshadow, Collab } from './FeatureVisuals'

/**
 * 레퍼런스
 * - Apple "Get to know" 갤러리: 고정 헤더 + 가로 트랙, 중앙 카드만 또렷하게
 * - Linear / Raycast 기능 카드: 아이콘 대신 실제 제품 UI 조각으로 설명
 * 카드 배경은 프라이머리 팔레트 스와치. 기능은 기획서 6장 핵심 기능 기준.
 */
const CARDS = [
  {
    hex: '#384959',
    tone: 'dark',
    title: '자연어 캐릭터 설계',
    body: '캐릭터를 문장으로 설명하세요. 성격 태그와 핵심 가치, 영향 관계로 자동 정리되고, 언제든 직접 고칠 수 있어요.',
    Visual: Character,
  },
  {
    hex: '#BDDDFC',
    tone: 'light',
    title: '설정 충돌 감지',
    body: '새 사건이 기존 설정과 어긋나면 조용히 알려드려요. 경고가 아닌 조언으로요.',
    Visual: Conflict,
  },
  {
    hex: '#88BDF2',
    tone: 'light',
    title: '관계 변화 시각화',
    body: '관계는 멈춰 있지 않아요. 챕터마다 달라지는 신뢰와 갈등을 타임라인으로 따라가세요.',
    Visual: Relation,
  },
  {
    hex: '#6A89A7',
    tone: 'dark',
    title: '복선 추적',
    body: '어디서 심었고, 어디서 거둘지. 복선의 설치와 회수 여부를 챕터 단위로 관리해요.',
    Visual: Foreshadow,
  },
  {
    hex: '#E5F0FF',
    tone: 'light',
    title: '함께 쓰기',
    body: '팀을 만들어 같은 원고를 함께 편집하고, 장면마다 피드백을 주고받으세요.',
    Visual: Collab,
  },
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

// 카드 위 마우스 위치를 따라가는 스포트라이트
const onSpot = (e: PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
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
    <section
      ref={ref}
      className="features"
      id="features"
      style={{ height: `calc(${distance * 1.15}px + 100vh)` }}
    >
      <div className="features__sticky">
        <header className="fx-head">
          <div>
            <h2>
              Prolog가 제공하는 기능들
            </h2>
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
              onPointerMove={onSpot}
            >
              <div className="fcard__visual">
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
