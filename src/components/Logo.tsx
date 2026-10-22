import './logo.css'

/** 슈퍼타원 |x|^5 + |y|^5 = 1 (애플 아이콘에 가까운 스퀴클) 윤곽을 32×32 안에 그린다 */
const SQUIRCLE_PATH = (() => {
  const n = 5
  const steps = 96
  const pts: string[] = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = 16 + 16 * Math.sign(c) * Math.abs(c) ** (2 / n)
    const y = 16 + 16 * Math.sign(s) * Math.abs(s) ** (2 / n)
    pts.push(`${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return `${pts.join('')}Z`
})()

const GLYPH = [
  'M356 775.074c63.167 72.333 234.9 178.899 416.5 26.5l181-190-79-92.5-198 162c-50.667 48.166-185.7 134.4-320.5 94',
  'M238 654.074c44.167 70.833 182.5 176.8 382.5 34 34-22.334 129.5-90.3 239.5-183.5l-87.5-108.5-245 166.5c-47.167 37.166-171.1 107.5-289.5 91.5',
  'M0 380.074c11.5 28.166 41.9 92.7 71.5 125.5 73-30 255.3-59.3 400.5 63.5l120.5-80.5c-97.333-85.167-352.1-226.1-592.5-108.5',
  'M90 527.074c32.5 61.833 148.6 159.5 353 55.5-46.667-41.334-182.6-110.3-353-55.5m885-208c-243.2-331.2-479.667-116.667-567.5 32 53.2 18.544 105.833 48.06 125.5 60.5 167.2-186.4 364.333-139.334 442-92.5',
  'M238 312.574c101.833-203.667 372.7-514.7 641.5-129.5-85.333-73.334-303.7-144.3-494.5 158.5-25.667-9.667-91-29-147-29m509.5 6.5 236.5 292.5c27.5 1.833 92-12.5 130-84.5l-147-176c-28.5-26.5-112.3-70-219.5-32m227.5 0 154.5 185.5 90-119c-3.33-14.667-56.9-48.5-244.5-66.5',
]

/** 스퀴클 블랙 타일 + 마크 + 워드마크. 마크만 쓸 때는 wordmark={false} */
export function Logo({ size = 32, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo__mark">
        <path d={SQUIRCLE_PATH} fill="var(--color-dark)" />
        {/* 글리프(1220×880)를 타일 가운데에 가로 20폭으로 앉힌다 */}
        <g transform="translate(6 16) scale(0.01639) translate(0 -440)" fill="#fff">
          {GLYPH.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
      {wordmark && <span className="logo__word">Prolog</span>}
    </span>
  )
}
