import type { Easing } from 'motion/react';

/**
 * Figma 타임라인: 모든 벡터가 하나의 2초 루프(cohort 212:804)를 공유한다.
 * 값은 Figma get_motion_context 스니펫 그대로.
 */
export const LOOP_DURATION = 2;

type Bezier = [number, number, number, number];

const EASE_IN_OUT: Bezier = [0.5, 0, 0.5, 1];
const EASE_OUT: Bezier = [0.5, 0.5, 0.5, 1];

/** pathLength=1 기준 stroke-dasharray 트랙 (Figma path trim) */
export interface DrawAnim {
  strokeDasharray: string[];
  times: number[];
  ease: Easing[];
}

/**
 * 선이 그려지기 전(dasharray '0 1')에는 투명하게 둔다.
 * 선 끝이 round라 길이 0짜리 선도 브라우저가 점으로 그리기 때문 (Figma trim path는 안 그림).
 * 그리기 시작하는 시점에 바로 켜지도록 opacity 트랙을 dasharray 타이밍에서 만든다.
 */
const REVEAL_EPSILON = 0.001;

export interface RevealTrack {
  opacity: number[];
  times: number[];
}

export function revealTrack({ strokeDasharray, times }: DrawAnim): RevealTrack {
  const firstDrawn = strokeDasharray.findIndex((v) => v !== strokeDasharray[0]);
  const start = times[Math.max(firstDrawn - 1, 0)];
  return start === 0
    ? { opacity: [0, 1, 1], times: [0, REVEAL_EPSILON, 1] }
    : { opacity: [0, 0, 1, 1], times: [0, start, start + REVEAL_EPSILON, 1] };
}

/** 벡터 전체(svg)를 x축으로 이동시키는 트랙 */
export interface SlideAnim {
  x: number[];
  times: number[];
  ease: Easing[];
}

/** start~end 구간 동안 선을 그리고, 루프 끝까지 유지 */
const drawBetween = (start: number, end: number, ease: Bezier): DrawAnim => ({
  strokeDasharray: ['0 1', '0 1', '1 1', '1 1'],
  times: [0, start, end, 1],
  ease: ['linear', ease, 'linear'],
});

export const DRAW = {
  /** Vector 10 (211:457) 및 동일 모션 노드 */
  intro: {
    strokeDasharray: ['0 1', '1 1', '1 1'],
    times: [0, 0.25, 1],
    ease: [EASE_IN_OUT, 'linear'],
  },
  /** Vector 12 (211:461) 및 동일 모션 노드 */
  late: drawBetween(0.175, 0.425, EASE_OUT),
  /** Vector 21 (212:563) 및 동일 모션 노드 */
  late2: drawBetween(0.225, 0.475, EASE_OUT),
  /** Vector 37 (212:688) */
  late3: drawBetween(0.275, 0.525, EASE_OUT),
  /** Vector 25 (212:630) */
  early: drawBetween(0.05, 0.3, EASE_IN_OUT),
  /** Vector 44 (212:749) */
  earlyOut: drawBetween(0.05, 0.3, EASE_OUT),
  /** Vector 27 (212:633) */
  delay10: drawBetween(0.1, 0.35, EASE_IN_OUT),
  /** Vector 41 (212:746) */
  usersBase: drawBetween(0.15, 0.4, EASE_OUT),
  /** Vector 42 (212:747) */
  usersRightHead: drawBetween(0.2, 0.45, EASE_IN_OUT),
  /** Vector 43 (212:748) */
  usersRightBody: drawBetween(0.25, 0.5, EASE_OUT),
  /** Vector 50 (212:3540) */
  logoutShaft: drawBetween(0.175, 0.425, EASE_IN_OUT),
  /** Vector 51/52 (212:3781, 212:3782) */
  arrowHead: drawBetween(0.175, 0.25, EASE_IN_OUT),
  /** Vector 40 (212:743) – 2단계로 그려짐 */
  twoStep: {
    strokeDasharray: ['0 1', '0 1', '0.0645 1', '1 1', '1 1'],
    times: [0, 0.1, 0.15, 0.35, 1],
    ease: ['linear', EASE_IN_OUT, EASE_IN_OUT, 'linear'],
  },
} satisfies Record<string, DrawAnim>;

export const SLIDE = {
  /** Vector 51/52 – 화살촉이 왼쪽 5.5px에서 출발해 제자리(화살 끝)로 이동 */
  arrowHead: {
    x: [-5.5, -5.5, 0, 0],
    times: [0, 0.25, 0.425, 1],
    ease: ['linear', EASE_OUT, 'linear'],
  },
} satisfies Record<string, SlideAnim>;
