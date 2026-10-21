import type { CSSProperties } from 'react'

const SKIES = ['sky-hero', 'sky-soft', 'sky-band'] as const
const SPOTS = ['20% 70%', '70% 40%', '45% 85%', '85% 60%', '10% 30%']

/** 같은 id면 늘 같은 구름 사진 조각을 고른다. 카드 썸네일 배경용 */
export function skyThumb(id: string): CSSProperties {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return {
    backgroundImage: `url(/brand/clouds/${SKIES[h % SKIES.length]}.webp)`,
    backgroundPosition: SPOTS[(h >> 3) % SPOTS.length],
  }
}
