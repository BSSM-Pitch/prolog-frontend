import { useId, type CSSProperties, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { LOGO_LAYERS } from './layers'
import { DRAWS, FADES, FRAME, LOOP_DURATION, type LogoPath } from './motion'

const LOOP = { duration: LOOP_DURATION, repeat: Infinity }

/** userSpaceOnUse 마스크 영역 — 굵은 선(최대 347)이 프레임 밖으로 나가도 잘리지 않게 넉넉히 */
const MASK_REGION = { x: -500, y: -500, width: FRAME.width + 1000, height: FRAME.height + 1000 }

function LogoPathShape({ path, playing }: { path: LogoPath; playing: boolean }) {
  const paint = path.strokeWidth
    ? { fill: 'none', stroke: 'currentColor', strokeWidth: path.strokeWidth }
    : { fill: 'currentColor' }
  const transform = `translate(${path.x} ${path.y})`
  const draw = path.draw ? DRAWS[path.draw] : undefined

  if (!draw || !playing) return <path d={path.d} transform={transform} {...paint} />

  return (
    <motion.path
      d={path.d}
      transform={transform}
      {...paint}
      pathLength={1}
      initial={{ strokeDasharray: '0 1', strokeDashoffset: 0 }}
      animate={{ strokeDasharray: draw.strokeDasharray, strokeDashoffset: draw.strokeDashoffset }}
      transition={{ ...LOOP, times: draw.times, ease: draw.ease }}
    />
  )
}

export interface LogoLoaderProps {
  /** 높이(px). 너비는 Figma 프레임 비율(2888:1000)을 따른다 */
  height?: number
  className?: string
  style?: CSSProperties
}

/**
 * Figma "logo_motion"(1603:463) — 로고 리본이 그려졌다 지워지는 6초 루프.
 * AI 응답을 기다리는 동안만 렌더링한다(마운트된 동안 무한 반복).
 * 색은 currentColor를 따르고, 장식용이라 aria-hidden — 상태 문구는 감싸는 요소에서 단다.
 * 움직임 줄이기 설정이면 완성된 로고를 정지 상태로 보여 준다.
 */
export function LogoLoader({ height = 24, className, style }: LogoLoaderProps) {
  const playing = !useReducedMotion()
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')

  return (
    <svg
      aria-hidden="true"
      data-node-id="1603:463"
      className={className}
      width={(height * FRAME.width) / FRAME.height}
      height={height}
      viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      fill="none"
      style={{ display: 'block', flex: 'none', color: '#000', ...style }}
    >
      {LOGO_LAYERS.map((layer, layerIndex) => {
        const maskId = (maskIndex: number) => `logo-${uid}-${layerIndex}-${maskIndex}`
        // content를 마스크로 한 겹씩 감싼다 → 모든 마스크의 교집합만 보인다
        const masked = layer.masks.reduce<ReactNode>(
          (inner, _, maskIndex) => <g mask={`url(#${maskId(maskIndex)})`}>{inner}</g>,
          <LogoPathShape path={layer.content} playing={playing} />,
        )
        const fade = playing ? FADES[layer.nodeId] : undefined

        return (
          <g key={layer.nodeId} data-node-id={layer.nodeId}>
            {layer.masks.map((mask, maskIndex) => (
              <mask
                key={maskIndex}
                id={maskId(maskIndex)}
                maskUnits="userSpaceOnUse"
                {...MASK_REGION}
                style={{ maskType: 'alpha' }}
              >
                <LogoPathShape path={mask} playing={playing} />
              </mask>
            ))}
            {fade ? (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: fade.opacity }}
                transition={{ opacity: { ...LOOP, times: fade.times, ease: 'linear' } }}
              >
                {masked}
              </motion.g>
            ) : (
              masked
            )}
          </g>
        )
      })}
    </svg>
  )
}
