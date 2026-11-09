import { useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'motion/react'
import { VOICE } from '../../../content/voice'
import { DEMOS } from '../demo'
import { DemoFrame } from '../demo/AppWindow'
import { useClock } from '../demo/clock'

const HOLD = 1.2
const num = (i: number) => String(i + 1).padStart(2, '0')

/**
 * 3. 기능 정리: 실제 앱 화면을 짧은 장면으로 보여 준다(레퍼런스: univai.co.kr 기능 탭).
 * 보이는 동안만 재생하고, 한 장면이 끝나면 다음 탭으로 넘어간다. 모션 감소면 마지막 장면에서 멈춘다.
 */
export function Features() {
  const { title, lead, items } = VOICE.features
  const [active, setActive] = useState(0)
  const stage = useRef<HTMLDivElement>(null)
  const inView = useInView(stage, { amount: 0.35 })
  const instant = useReducedMotion() ?? false

  const item = items[active]
  const { Demo, length, path } = DEMOS[item.key]
  const end = length + HOLD
  const t = useClock({
    key: item.key,
    playing: inView,
    end,
    instant,
    onDone: () => setActive((i) => (i + 1) % items.length),
  })

  return (
    <section className="lp-section features" id="features" aria-labelledby="features-title">
      <header className="lp-section__head">
        <h2 id="features-title">{title}</h2>
        <p>{lead}</p>
      </header>

      <div className="features__tabs" role="tablist" aria-label="Prolog 도구">
        {items.map((it, i) => (
          <button
            key={it.key}
            type="button"
            role="tab"
            id={`feature-tab-${it.key}`}
            aria-selected={i === active}
            aria-controls="feature-panel"
            className="features__tab"
            onClick={() => setActive(i)}
          >
            <span className="features__num">{num(i)}</span>
            {it.title}
            {i === active && !instant && (
              <span className="features__progress" aria-hidden="true">
                <span style={{ transform: `scaleX(${Math.min(1, t / end)})` }} />
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        ref={stage}
        className="features__stage"
        id="feature-panel"
        role="tabpanel"
        aria-labelledby={`feature-tab-${item.key}`}
      >
        <div className="features__copy" key={item.key}>
          <span className="features__num">{num(active)}</span>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </div>
        <div className="features__screen" aria-hidden="true">
          <DemoFrame path={path}>
            <Demo key={item.key} t={t} />
          </DemoFrame>
        </div>
      </div>
    </section>
  )
}
