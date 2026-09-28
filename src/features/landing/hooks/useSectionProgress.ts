import type { RefObject } from 'react'
import { useScroll, useTransform } from 'motion/react'

type Offset = NonNullable<Parameters<typeof useScroll>[0]>['offset']

/**
 * 섹션 스크롤 진행도(0~1).
 * motion 은 useScroll 값을 네이티브 ScrollTimeline 으로 가속하려 하는데,
 * sticky + offset 조합에서 구간이 어긋나는 문제가 있어
 * 함수형 transform 으로 한 번 감싸 JS 경로로 고정한다.
 */
export function useSectionProgress(
  ref: RefObject<HTMLElement | null>,
  offset: Offset = ['start start', 'end end'],
) {
  const { scrollYProgress } = useScroll({ target: ref, offset })
  return useTransform(scrollYProgress, (v) => v)
}
