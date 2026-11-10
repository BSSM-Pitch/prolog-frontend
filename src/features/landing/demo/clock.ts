import { useEffect, useRef, useState } from 'react'

const TICK = 70

/**
 * 데모 한 편의 재생 시계(초). playing일 때만 흐르고, end에 닿으면 onDone을 한 번 부른다.
 * 모션 감소면 처음부터 마지막 장면(end)을 보여 주고 흐르지 않는다.
 * key가 바뀌면(다른 데모로 넘어가면) 0부터 다시 잰다.
 */
export function useClock({
  key,
  playing,
  end,
  instant,
  onDone,
}: {
  key: string
  playing: boolean
  end: number
  instant: boolean
  onDone: () => void
}) {
  const [state, setState] = useState({ key, t: 0 })
  const t = instant ? end : state.key === key ? state.t : 0
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    if (!playing || instant) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      setState((s) => {
        const base = s.key === key ? s.t : 0
        return { key, t: Math.min(end, base + dt) }
      })
    }, TICK)
    return () => window.clearInterval(id)
  }, [key, playing, instant, end])

  useEffect(() => {
    if (!instant && t >= end) done.current()
  }, [t, end, instant])

  return t
}

/** start초부터 초당 cps 글자씩 쳐 나간 문자열 */
export function typed(text: string, t: number, start: number, cps = 18) {
  if (t <= start) return ''
  const chars = [...text]
  return chars.slice(0, Math.floor((t - start) * cps)).join('')
}

/** text를 다 치는 데 걸리는 시간 */
export const typingTime = (text: string, cps = 18) => [...text].length / cps
