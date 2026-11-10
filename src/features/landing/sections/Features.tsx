import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { VOICE, type FeatureKey } from '../../../content/voice'
import { DEMOS } from '../demo'
import { DemoFrame } from '../demo/AppWindow'
import { useClock } from '../demo/clock'
import { scrollToY } from '../hooks/useLenis'

const HOLD = 1.2
const num = (i: number) => String(i + 1).padStart(2, '0')

/* 가로 스크롤 시간표(화면 높이 단위). 장면마다 STAY만큼 머문 뒤 MOVE만큼 스크롤해 다음 장면으로 민다 */
const STAY = 0.6
const MOVE = 0.9
/** 이 단위 하나에 해당하는 스크롤 거리(vh) */
const UNIT_VH = 80

/**
 * 3. 기능 정리: 실제 앱 화면을 장면별로 가로로 늘어놓는다.
 * 섹션에 들어오면 화면이 고정되고, 아래로 스크롤하는 만큼 장면이 옆으로 넘어간다.
 * 마지막 장면까지 넘기면 고정이 풀리고 다시 아래로 내려간다. 각 장면의 데모는 화면 가운데 올 때 재생한다.
 * 모션 감소면 고정 없이 장면을 위아래로 쌓고 마지막 장면을 그대로 보여 준다.
 */
export function Features() {
  const { title, lead, items } = VOICE.features
  const instant = useReducedMotion() ?? false
  const n = items.length
  const units = n * STAY + (n - 1) * MOVE

  const runway = useRef<HTMLDivElement>(null)
  const pin = useRef<HTMLDivElement>(null)
  const tabs = useRef<HTMLElement>(null)
  const pinned = useInView(pin, { amount: 0.6 })
  const { scrollYProgress } = useScroll({ target: runway, offset: ['start start', 'end end'] })

  // 진행률(0–1) → 장면 위치(0–n-1). 머무는 구간은 평평하게, 넘기는 구간은 기울게
  const input: number[] = []
  const output: number[] = []
  for (let i = 0; i < n; i++) {
    const start = i * (STAY + MOVE)
    input.push(start / units, (start + STAY) / units)
    output.push(i, i)
  }
  const pos = useTransform(scrollYProgress, input, output)
  const x = useTransform(pos, (v) => `calc(${-v} * (100% + var(--features-gap)))`)

  const [active, setActive] = useState(0)
  useMotionValueEvent(pos, 'change', (v) => setActive(Math.round(v)))

  // 좁은 화면에서 탭 줄이 넘치면 지금 장면의 탭이 보이도록 탭 줄만 옆으로 민다(문서는 스크롤하지 않는다)
  useEffect(() => {
    const bar = tabs.current
    const tab = bar?.children[active] as HTMLElement | undefined
    if (!bar || !tab || bar.scrollWidth <= bar.clientWidth) return
    bar.scrollTo({ left: tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2, behavior: 'smooth' })
  }, [active])

  // 탭을 누르면 그 장면이 머무는 구간의 가운데로 스크롤한다
  function goTo(i: number) {
    const el = runway.current
    if (!el) return
    if (instant) {
      document.getElementById(`feature-${items[i].key}`)?.scrollIntoView()
      return
    }
    const top = el.getBoundingClientRect().top + window.scrollY
    const span = el.offsetHeight - window.innerHeight
    scrollToY(top + (span * (i * (STAY + MOVE) + STAY / 2)) / units)
  }

  return (
    <section
      className={`lp-section features${instant ? ' features--static' : ''}`}
      id="features"
      aria-labelledby="features-title"
    >
      <header className="lp-section__head">
        <h2 id="features-title">{title}</h2>
        <p>{lead}</p>
      </header>

      <div
        ref={runway}
        className="features__runway"
        style={instant ? undefined : { height: `calc(100svh + ${units * UNIT_VH}svh)` }}
      >
        <div ref={pin} className="features__pin">
          <nav ref={tabs} className="features__tabs" aria-label="Prolog 도구">
            {items.map((it, i) => (
              <button
                key={it.key}
                type="button"
                aria-current={i === active ? 'step' : undefined}
                className="features__tab"
                onClick={() => goTo(i)}
              >
                <span className="features__num">{num(i)}</span>
                {it.title}
              </button>
            ))}
            {!instant && <Progress value={scrollYProgress} />}
          </nav>

          <motion.ol className="features__track" style={instant ? undefined : { x }}>
            {items.map((it, i) => (
              <Scene
                key={it.key}
                index={i}
                featureKey={it.key}
                title={it.title}
                body={it.body}
                playing={pinned && i === active}
                instant={instant}
              />
            ))}
          </motion.ol>
        </div>
      </div>
    </section>
  )
}

function Progress({ value }: { value: MotionValue<number> }) {
  return (
    <span className="features__progress" aria-hidden="true">
      <motion.span style={{ scaleX: value }} />
    </span>
  )
}

function Scene({
  index,
  featureKey,
  title,
  body,
  playing,
  instant,
}: {
  index: number
  featureKey: FeatureKey
  title: string
  body: string
  playing: boolean
  instant: boolean
}) {
  const { Demo, length, path } = DEMOS[featureKey]
  const t = useClock({ key: featureKey, playing, end: length + HOLD, instant, onDone: () => {} })

  return (
    <li className="features__stage" id={`feature-${featureKey}`} aria-current={playing ? 'step' : undefined}>
      <div className="features__copy">
        <span className="features__num">{num(index)}</span>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <div className="features__screen" aria-hidden="true">
        <DemoFrame path={path}>
          <Demo t={t} />
        </DemoFrame>
      </div>
    </li>
  )
}
