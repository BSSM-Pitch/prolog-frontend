import { useState } from 'react'

/** 마우스를 올린 동안 true — 아이콘을 감싼 메뉴 항목에 붙인다 */
export function useHoverPlay() {
  const [playing, setPlaying] = useState(false)
  return {
    playing,
    hoverProps: {
      onMouseEnter: () => setPlaying(true),
      onMouseLeave: () => setPlaying(false),
    },
  }
}
