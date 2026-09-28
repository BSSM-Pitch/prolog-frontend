/** public/landing/frames 에 추출된 WebP 시퀀스 (ffmpeg, 12fps, 1280w). 쓰는 프레임만 옮겨 왔다 */
export const FRAMES = {
  hero: { name: 'hero', count: 72 }, // 키보드 타이핑 (122프레임 중 앞 6초만 사용해 천천히 스크럽)
  talk: { name: 'talk', count: 80 }, // 대화 · 인터뷰
  hand: { name: 'hand', count: 120 }, // 손글씨
  type: { name: 'type', count: 156 }, // 타자기 "FOLLOW US."
} as const
