import { useLayoutEffect, useRef, useState } from 'react'
import type { OAuthProvider } from '../api/types'
import googleLogo from '../assets/social/google.png'
import naverLogo from '../assets/social/naver.png'
import './ui.css'

interface SocialButtonsProps {
  mode: 'login' | 'signup'
  onSelect: (provider: OAuthProvider) => void
  disabled?: boolean
}

const PROVIDERS: Array<{ id: OAuthProvider; logo: string; name: string }> = [
  { id: 'google', logo: googleLogo, name: 'Google' },
  { id: 'naver', logo: naverLogo, name: '네이버' },
]

/** 위쪽 가운데에서 출발해 시계 반대 방향으로 한 바퀴 도는 둥근 사각형 경로 (선 두께 bw의 중심선).
 *  화면 배율에 따라 CSS 테두리 두께가 1px이 아닐 수 있어(예: 175% → 0.57px) 실제 두께로 맞춘다 */
function tracePath(w: number, h: number, radius: number, bw: number) {
  const half = bw / 2
  const r = Math.max(0, Math.min(radius - half, w / 2 - half, h / 2 - half))
  const l = half
  const t = half
  const rt = w - half
  const b = h - half
  return [
    `M${w / 2} ${t}`,
    `H${l + r}`,
    `A${r} ${r} 0 0 0 ${l} ${t + r}`,
    `V${b - r}`,
    `A${r} ${r} 0 0 0 ${l + r} ${b}`,
    `H${rt - r}`,
    `A${r} ${r} 0 0 0 ${rt} ${b - r}`,
    `V${t + r}`,
    `A${r} ${r} 0 0 0 ${rt - r} ${t}`,
    // 출발점을 1px 지나쳐 끝나야 이음매에 빈틈이 안 생긴다 (Z로 닫으면 butt 끝이 맞닿는 곳에 틈이 남는다)
    `H${w / 2 - 1}`,
  ].join(' ')
}

function SocialButton({
  provider,
  suffix,
  disabled,
  onSelect,
}: {
  provider: (typeof PROVIDERS)[number]
  suffix: string
  disabled?: boolean
  onSelect: (provider: OAuthProvider) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [trace, setTrace] = useState<{ w: number; h: number; bw: number; d: string } | null>(null)

  // 버튼 크기(테두리 포함)와 border-radius에 맞춰 경로를 다시 만든다
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const cs = getComputedStyle(el)
      const radius = parseFloat(cs.borderTopLeftRadius) || 0
      const bw = parseFloat(cs.borderTopWidth) || 1
      setTrace((prev) => {
        const d = tracePath(w, h, radius, bw)
        return prev && prev.d === d && prev.bw === bw ? prev : { w, h, bw, d }
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <button ref={ref} type="button" className="social__btn" disabled={disabled} onClick={() => onSelect(provider.id)}>
      {trace && (
        <svg
          className="social__trace"
          style={{ left: -trace.bw, top: -trace.bw, width: trace.w, height: trace.h }}
          viewBox={`0 0 ${trace.w} ${trace.h}`}
          aria-hidden="true"
        >
          <path d={trace.d} pathLength={1} strokeWidth={trace.bw} />
        </svg>
      )}
      <img className={`social__mark social__mark--${provider.id}`} src={provider.logo} alt="" aria-hidden="true" />
      {provider.name}로 {suffix}
    </button>
  )
}

export function SocialButtons({ mode, onSelect, disabled }: SocialButtonsProps) {
  const suffix = mode === 'login' ? '로그인' : '회원가입'
  return (
    <div className="social">
      {PROVIDERS.map((p) => (
        <SocialButton key={p.id} provider={p} suffix={suffix} disabled={disabled} onSelect={onSelect} />
      ))}
    </div>
  )
}
