import type { CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ICONS, STROKE_PAD, type IconName, type IconVector } from './icons'
import { LOOP_DURATION } from './motion'
import { PATHS } from './paths'

const STROKE_WIDTH = 1.35

function AnimatedVector({
  vector,
  originX,
  originY,
  playing,
}: {
  vector: IconVector
  originX: number
  originY: number
  playing: boolean
}) {
  const { d, width, height } = PATHS[vector.path]
  const loop = { duration: LOOP_DURATION, repeat: Infinity }
  const slide = playing ? vector.slide : undefined

  return (
    <motion.svg
      data-node-id={vector.nodeId}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      overflow="visible"
      aria-hidden="true"
      style={{
        position: 'absolute',
        display: 'block',
        left: vector.x - originX - STROKE_PAD,
        top: vector.y - originY - (vector.padTop ?? STROKE_PAD),
      }}
      initial={slide ? { x: slide.x[0] } : false}
      animate={slide ? { x: slide.x } : undefined}
      transition={slide ? { ...loop, times: slide.times, ease: slide.ease } : undefined}
    >
      <motion.path
        d={d}
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        pathLength={1}
        initial={playing ? { strokeDasharray: '0 1', strokeDashoffset: 0 } : false}
        animate={playing ? { strokeDasharray: vector.draw.strokeDasharray } : undefined}
        transition={{ ...loop, times: vector.draw.times, ease: vector.draw.ease }}
      />
    </motion.svg>
  )
}

export interface MotionIconProps {
  name: IconName
  /** true인 동안 Figma 모션(2초 루프)을 재생, false면 완성된 정지 아이콘 */
  playing?: boolean
  /** 아이콘을 담는 정사각형 박스 크기(px). 아이콘은 가운데 정렬 */
  size?: number
  className?: string
  style?: CSSProperties
}

/**
 * Figma "Motion Icon"(212:804)의 선 그리기 아이콘. 색은 currentColor를 따른다.
 * 장식용이라 aria-hidden — 라벨은 감싸는 요소에서 단다.
 */
export function MotionIcon({ name, playing = false, size = 19, className, style }: MotionIconProps) {
  const reduceMotion = useReducedMotion()
  const icon = ICONS[name]
  const isPlaying = playing && !reduceMotion

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: 'grid', placeItems: 'center', flex: 'none', width: size, height: size, ...style }}
    >
      {/* 재생이 시작될 때마다 처음부터 그리도록 key로 다시 마운트 */}
      <span
        key={isPlaying ? 'play' : 'idle'}
        data-node-id={icon.nodeId}
        style={{ position: 'relative', display: 'block', width: icon.width, height: icon.height }}
      >
        {icon.vectors.map((vector) => (
          <AnimatedVector
            key={vector.nodeId}
            vector={vector}
            originX={icon.x}
            originY={icon.y}
            playing={isPlaying}
          />
        ))}
      </span>
    </span>
  )
}
