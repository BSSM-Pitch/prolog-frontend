import type { Easing } from 'motion/react'

/**
 * Figma 타임라인: 모든 레이어가 하나의 6초 루프(cohort 1603:463)를 공유한다.
 * 값은 Figma get_motion_context 스니펫 그대로.
 */
export const LOOP_DURATION = 6

/** Figma 프레임 크기 — viewBox로 그대로 쓴다 */
export const FRAME = { width: 2888, height: 1000 } as const

type Bezier = [number, number, number, number]

const EASE_IN_OUT: Bezier = [0.5, 0, 0.5, 1]
const EASE_DRAW_IN: Bezier = [0.345, 0, 0.678, 0.341]
const EASE_DRAW_OUT: Bezier = [0.474, 0.065, 0.492, 1]
const EASE_SHORT_IN: Bezier = [0.482, 0, 0.755, 0.469]
const EASE_SHORT_OUT: Bezier = [0.262, 0.465, 0.485, 1]

/** 경로 하나 (프레임 좌표 x, y만큼 옮겨 그린다) */
export interface LogoPath {
  name: string
  d: string
  x: number
  y: number
  /** 있으면 선(stroke), 없으면 채움(fill) */
  strokeWidth?: number
  /** 선 그리기(path trim) 트랙의 Figma 노드 id → DRAWS */
  draw?: string
}

export interface LogoLayer {
  nodeId: string
  content: LogoPath
  /** 교집합으로 겹치는 마스크들 (Figma 마스크 그룹 중첩) */
  masks: LogoPath[]
}

/** pathLength=1 기준 stroke-dasharray / stroke-dashoffset 트랙 (Figma path trim) */
export interface DrawAnim {
  strokeDasharray: string[]
  strokeDashoffset: number[]
  times: number[]
  ease: Easing | Easing[]
}

export const DRAWS: Record<string, DrawAnim> = {
  // Vector 24
  '1771:32': {
    strokeDasharray: ['0 1', '0.34 1', '0.9977 1', '0.9965 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, -0.0035, -1, -1],
    times: [0, 0.55, 0.708, 0.717, 0.875, 1],
    ease: ['linear', 'linear', EASE_DRAW_IN, EASE_DRAW_OUT, 'linear'],
  },
  // Vector 25
  '1771:86': {
    strokeDasharray: ['0 1', '0.39 1', '0.9979 1', '0.9965 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, -0.0035, -1, -1],
    times: [0, 0.533, 0.692, 0.7, 0.858, 1],
    ease: ['linear', 'linear', EASE_DRAW_IN, EASE_DRAW_OUT, 'linear'],
  },
  // Vector 23
  '1754:207': {
    strokeDasharray: ['0 1', '0.27 1', '1 1', '1 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, 0, -1, -1],
    times: [0, 0.517, 0.683, 0.742, 0.908, 1],
    ease: ['linear', 'linear', 'linear', EASE_IN_OUT, 'linear'],
  },
  // Vector 22
  '1754:159': {
    strokeDasharray: ['0 1', '0.28 1', '1 1', '1 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, 0, -1, -1],
    times: [0, 0.5, 0.667, 0.725, 0.892, 1],
    ease: ['linear', 'linear', 'linear', EASE_IN_OUT, 'linear'],
  },
  // Vector 21
  '1603:451': {
    strokeDasharray: ['0 1', '0 1', '1 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, -1, -1],
    times: [0, 0.117, 0.283, 0.55, 1],
    ease: 'linear',
  },
  // Vector 20
  '1603:440': {
    strokeDasharray: ['0 1', '0 1', '1 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, -1, -1],
    times: [0, 0.1, 0.267, 0.533, 1],
    ease: 'linear',
  },
  // Vector 19
  '1603:429': {
    strokeDasharray: ['0 1', '0 1', '1 1', '1 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, 0, -1, -1],
    times: [0, 0.083, 0.25, 0.642, 0.808, 1],
    ease: ['linear', 'linear', 'linear', EASE_IN_OUT, 'linear'],
  },
  // Vector 18
  '1603:418': {
    strokeDasharray: ['0 1', '0 1', '1 1', '1 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, 0, -1, -1],
    times: [0, 0.067, 0.233, 0.625, 0.792, 1],
    ease: ['linear', 'linear', 'linear', EASE_IN_OUT, 'linear'],
  },
  // Vector 17
  '1603:407': {
    strokeDasharray: ['0 1', '0 1', '0.5988 1', '0.5988 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, -0.4012, -1, -1],
    times: [0, 0.05, 0.142, 0.217, 0.308, 1],
    ease: ['linear', 'linear', EASE_SHORT_IN, EASE_SHORT_OUT, 'linear'],
  },
  // Vector 16
  '1603:370': {
    strokeDasharray: ['0 1', '0 1', '0.5988 1', '0.5988 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, -0.4012, -1, -1],
    times: [0, 0.033, 0.125, 0.2, 0.292, 1],
    ease: ['linear', 'linear', EASE_SHORT_IN, EASE_SHORT_OUT, 'linear'],
  },
  // Vector 14
  '1596:44': {
    strokeDasharray: ['0 1', '0 1', '0.9965 1', '0.9965 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, -0.0035, -1, -1],
    times: [0, 0.017, 0.175, 0.183, 0.342, 1],
    ease: ['linear', 'linear', EASE_DRAW_IN, EASE_DRAW_OUT, 'linear'],
  },
  // Vector 15
  '1596:94': {
    strokeDasharray: ['0 1', '0.9965 1', '0.9965 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, -0.0035, -1, -1],
    times: [0, 0.158, 0.167, 0.325, 1],
    ease: ['linear', EASE_DRAW_IN, EASE_DRAW_OUT, 'linear'],
  },
  // Vector 27
  '1830:383': {
    strokeDasharray: ['0 1', '1 1', '1 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, -1, -1],
    times: [0, 0.217, 0.608, 0.775, 1],
    ease: ['linear', 'linear', EASE_IN_OUT, 'linear'],
  },
  // Vector 26
  '1830:327': {
    strokeDasharray: ['0 1', '1 1', '1 1', '0 1', '0 1'],
    strokeDashoffset: [0, 0, 0, -1, -1],
    times: [0, 0.2, 0.592, 0.758, 1],
    ease: ['linear', 'linear', EASE_IN_OUT, 'linear'],
  },
}

/** 레이어 전체를 켜고 끄는 opacity 트랙 (Vector 4, Vector 3) */
export interface FadeAnim {
  opacity: number[]
  times: number[]
}

export const FADES: Record<string, FadeAnim> = {
  // Vector 4
  '1612:197': { opacity: [0, 0, 1, 1, 0, 0], times: [0, 0.1832, 0.1833, 0.5832, 0.5833, 1] },
  // Vector 3
  '1612:195': { opacity: [0, 0, 1, 1, 0, 0], times: [0, 0.1666, 0.1667, 0.5666, 0.5667, 1] },
}
