import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { useInView, useReducedMotion } from 'motion/react'
import { toPaths, type Drawable } from './rough'

/**
 * 펜화 한 장. 화면에 들어오면 선이 차례로 그려지고, 글이 차례로 나타난다.
 * 그리기는 CSS transition(stroke-dashoffset·opacity)이 맡고, React는 data-on 하나만 바꾼다.
 * 모션 감소 설정이면 완성된 그림을 바로 보여 준다.
 * replay: 위로 스크롤해 그림이 화면 아래로 빠져나가면 그린 순서를 거꾸로 되감고, 다시 내려오면 처음부터 그린다.
 */
type Ctx = { w: number; h: number }
const FigureCtx = createContext<Ctx>({ w: 100, h: 100 })

type Vars = CSSProperties & Record<`--${string}`, string>

export function Figure({
  w,
  h,
  label,
  className,
  children,
  amount = 0.3,
  eager = false,
  replay = false,
}: {
  w: number
  h: number
  /** 그림의 내용을 설명하는 대체 텍스트. 없으면 장식으로 취급한다 */
  label?: string
  className?: string
  children: ReactNode
  amount?: number
  /** 첫 화면의 그림처럼 화면 진입을 기다리지 않고 바로 그린다 */
  eager?: boolean
  /** 위로 스크롤하면 되감고, 다시 보이면 다시 그린다 */
  replay?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount })
  const shown = useReplay(ref, replay, amount)
  const instant = useReducedMotion() ?? false
  const on = eager || instant || (replay ? shown : inView)
  const ctx = useMemo(() => ({ w, h }), [w, h])

  // 되감기는 가장 늦게 그려지는 선부터 거꾸로 지운다. 그 기준이 되는 마지막 시작 시각을 잰다
  useLayoutEffect(() => {
    const el = ref.current
    if (!replay || !el) return
    let max = 0
    for (const node of el.querySelectorAll<HTMLElement | SVGElement>('[style*="--d"]'))
      max = Math.max(max, parseFloat(node.style.getPropertyValue('--d')) || 0)
    el.style.setProperty('--dmax', `${max}s`)
  }, [replay])

  return (
    <div
      ref={ref}
      className={`ink-figure${className ? ` ${className}` : ''}`}
      style={{ aspectRatio: `${w} / ${h}` }}
      data-on={on || undefined}
      data-instant={instant || undefined}
      data-replay={replay || undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <FigureCtx.Provider value={ctx}>{children}</FigureCtx.Provider>
    </div>
  )
}

/**
 * 화면에 amount만큼 들어오면 true. 위로 스크롤해 화면 아래쪽으로 빠져나갈 때만 false로 돌아가고,
 * 아래로 지나쳐 화면 위로 사라질 때는 그린 상태를 유지한다.
 */
function useReplay(ref: RefObject<HTMLDivElement | null>, enabled: boolean, amount: number) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= amount) setShown(true)
        else if (entry.boundingClientRect.top > 0) setShown(false)
      },
      { threshold: [0, amount] },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, enabled, amount])
  return shown
}

/** 그림의 일부를 따로 움직이게 묶는 층. 그림과 같은 크기라 안의 좌표는 그대로다 */
export function Layer({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={`ink-layer${className ? ` ${className}` : ''}`}>{children}</div>
}

/** 선 묶음. 그림 하나에 여러 번 써서 그리는 순서를 나눈다 */
export function Strokes({
  shapes,
  delay = 0,
  step = 0.08,
  duration = 0.7,
  transform,
}: {
  shapes: Drawable[]
  delay?: number
  step?: number
  duration?: number
  transform?: string
}) {
  const { w, h } = useContext(FigureCtx)
  const paths = useMemo(() => shapes.flatMap((s, i) => toPaths(s).map((p) => ({ ...p, i }))), [shapes])

  return (
    <svg className="ink-figure__svg" viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
      <g transform={transform}>
        {paths.map((p, k) => {
          const at = `${(delay + p.i * step).toFixed(2)}s`
          if (p.fill && p.fill !== 'none') {
            return <path key={k} className="ink-fill" d={p.d} style={{ fill: p.fill, '--d': at } as Vars} />
          }
          return (
            <path
              key={k}
              className="ink-stroke"
              d={p.d}
              pathLength={1}
              style={{ stroke: p.stroke, strokeWidth: p.strokeWidth, '--d': at, '--t': `${duration}s` } as Vars}
            />
          )
        })}
      </g>
    </svg>
  )
}

/**
 * 그림 위에 얹는 글. 좌표·크기는 그림의 viewBox 단위로 받아 비율로 바꾼다.
 * center: (x, y)를 글 상자의 가운데로 삼는다.
 */
export function Note({
  x,
  y,
  size,
  width,
  rotate = 0,
  delay = 0,
  center = false,
  className,
  children,
}: {
  x: number
  y: number
  size: number
  width?: number
  rotate?: number
  delay?: number
  center?: boolean
  className?: string
  children: ReactNode
}) {
  const { w, h } = useContext(FigureCtx)
  const style: Vars = {
    left: `${(x / w) * 100}%`,
    top: `${(y / h) * 100}%`,
    width: width ? `${(width / w) * 100}%` : undefined,
    fontSize: `${(size / w) * 100}cqw`,
    rotate: rotate ? `${rotate}deg` : undefined,
    translate: center ? '-50% -50%' : undefined,
    '--d': `${delay}s`,
  }
  return (
    <div className={`ink-note${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  )
}

export function Mark({ tone, children }: { tone: 'character' | 'setting' | 'review'; children: ReactNode }) {
  return <mark className={`ink-mark ink-mark--${tone}`}>{children}</mark>
}
