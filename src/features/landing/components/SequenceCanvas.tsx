import { useCallback, useEffect, useRef, useState } from 'react'
import { type MotionValue, useMotionValueEvent } from 'motion/react'

type Props = {
  /** public/landing/frames/<name>/001.webp … */
  name: string
  count: number
  progress: MotionValue<number>
  /** 뷰포트 진입 전부터 즉시 로드 (히어로 등) */
  eager?: boolean
  className?: string
  /** 프레임 크롭 기준점 (0~1). MotionValue 를 주면 스크롤에 따라 팬(pan) 한다 */
  focusX?: number | MotionValue<number>
  focusY?: number
}

const frameSrc = (name: string, i: number) =>
  `${import.meta.env.BASE_URL}landing/frames/${name}/${String(i + 1).padStart(3, '0')}.webp`

/**
 * 로드 순서: 첫 프레임 → 8프레임 간격 → 4 → 2 → 나머지.
 * 전체가 받아지기 전에도 스크럽이 거칠게나마 즉시 동작하도록 한다.
 */
function loadOrder(count: number) {
  const seen = new Set<number>([0])
  const order = [0]
  for (const step of [8, 4, 2, 1]) {
    for (let i = 0; i < count; i += step) {
      if (!seen.has(i)) {
        seen.add(i)
        order.push(i)
      }
    }
  }
  if (!seen.has(count - 1)) order.push(count - 1)
  return order
}

export function SequenceCanvas({
  name,
  count,
  progress,
  eager = false,
  className,
  focusX = 0.5,
  focusY = 0.5,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frames = useRef<(HTMLImageElement | undefined)[]>([])
  const drawn = useRef<HTMLImageElement | undefined>(undefined)
  const drawnFocus = useRef(-1)
  const [ready, setReady] = useState(false)

  const draw = useCallback(
    (force = false) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return

      const p = Math.min(1, Math.max(0, progress.get()))
      const target = Math.round(p * (count - 1))
      // 아직 로드되지 않은 프레임이면 가장 가까운 로드된 프레임으로 대체
      let img = frames.current[target]
      for (let d = 1; !img && d < count; d++) {
        img = frames.current[target - d] ?? frames.current[target + d]
      }
      const fx = typeof focusX === 'number' ? focusX : focusX.get()
      if (!img || (!force && img === drawn.current && fx === drawnFocus.current)) return
      drawn.current = img
      drawnFocus.current = fx

      // object-fit: cover
      const { width: cw, height: ch } = canvas
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
      const w = img.naturalWidth * scale
      const h = img.naturalHeight * scale
      ctx.drawImage(img, (cw - w) * fx, (ch - h) * focusY, w, h)
    },
    [count, progress, focusX, focusY],
  )

  useMotionValueEvent(progress, 'change', () => draw())

  // 캔버스 해상도를 실제 픽셀에 맞춤
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(entry.contentRect.width * dpr)
      canvas.height = Math.round(entry.contentRect.height * dpr)
      draw(true)
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  // 프레임 로딩 (eager가 아니면 뷰포트 근처에서 시작)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false

    const start = async () => {
      const order = loadOrder(count)
      const load = (i: number) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.decoding = 'async'
          img.src = frameSrc(name, i)
          img
            .decode()
            .then(() => {
              if (cancelled) return
              frames.current[i] = img
              if (i === 0) setReady(true)
              draw(true)
            })
            .catch(() => {})
            .finally(resolve)
        })

      await load(order[0])
      // 동시 6개씩 병렬 로드
      const queue = order.slice(1)
      const worker = async () => {
        while (queue.length && !cancelled) await load(queue.shift()!)
      }
      await Promise.all(Array.from({ length: 6 }, worker))
    }

    if (eager) {
      start()
      return () => {
        cancelled = true
      }
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          io.disconnect()
          start()
        }
      },
      { rootMargin: '150% 0px' },
    )
    io.observe(canvas)
    return () => {
      cancelled = true
      io.disconnect()
    }
  }, [name, count, eager, draw])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      data-ready={ready}
      aria-hidden="true"
    />
  )
}
