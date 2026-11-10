import rough from 'roughjs'
import type { Drawable, Options } from 'roughjs/bin/core'

/**
 * 펜화용 손그림 경로 생성기. roughjs의 generator로 경로 문자열만 만들고, 그리는 일은 React가 맡는다.
 * 시드를 고정해 새로 고침해도 같은 선이 나온다.
 */
const gen = rough.generator()

export const INK = 'var(--itda-ink)'
export const MUTED = 'var(--itda-muted)'
/** 인물·설정·검토는 실제 앱 하이라이트 토큰을 펜화 형광펜 농도로 조금 진하게 섞어 쓴다 */
export const WASH = {
  paper: 'var(--itda-surface)',
  sheet: '#fafaf8',
  character: 'var(--lp-wash-character)',
  setting: 'var(--lp-wash-setting)',
  review: 'var(--lp-wash-review)',
} as const
export const REVIEW_INK = 'var(--prolog-review-ink)'

let seed = 7
const base = (o?: Options): Options => ({
  roughness: 1.15,
  bowing: 1.1,
  stroke: INK,
  strokeWidth: 1.7,
  fillWeight: 0.9,
  hachureGap: 7,
  disableMultiStrokeFill: true,
  hachureAngle: -41,
  seed: (seed = (seed * 48271) % 2147483647),
  ...o,
})

type Pt = [number, number]

export const ink = {
  line: (x1: number, y1: number, x2: number, y2: number, o?: Options) => gen.line(x1, y1, x2, y2, base(o)),
  rect: (x: number, y: number, w: number, h: number, o?: Options) => gen.rectangle(x, y, w, h, base(o)),
  ellipse: (cx: number, cy: number, w: number, h: number, o?: Options) => gen.ellipse(cx, cy, w, h, base(o)),
  circle: (cx: number, cy: number, d: number, o?: Options) => gen.circle(cx, cy, d, base(o)),
  poly: (pts: Pt[], o?: Options) => gen.polygon(pts, base(o)),
  open: (pts: Pt[], o?: Options) => gen.linearPath(pts, base(o)),
  curve: (pts: Pt[], o?: Options) => gen.curve(pts, base(o)),
  path: (d: string, o?: Options) => gen.path(d, base(o)),
}

/** 손글씨 줄을 흉내 낸 물결선. 단어 사이에는 틈을 둔다 */
export function scribble(x: number, y: number, w: number, o?: Options): Drawable[] {
  const words: Drawable[] = []
  let cx = x
  let i = 0
  while (cx < x + w - 12) {
    const len = Math.min(x + w - cx, 26 + ((i * 37) % 44))
    const pts: Pt[] = []
    for (let k = 0; k <= len; k += 5) pts.push([cx + k, y + (k % 10 === 0 ? -3.2 : 2.4)])
    words.push(ink.curve(pts, { roughness: 0.5, strokeWidth: 1.25, stroke: MUTED, disableMultiStroke: true, ...o }))
    cx += len + 9
    i += 1
  }
  return words
}

/** 가는 물결 밑줄 (설정 검토 표시) */
export function wavy(x: number, y: number, w: number, o?: Options): Drawable {
  const pts: Pt[] = []
  for (let k = 0; k <= w; k += 6) pts.push([x + k, y + (k % 12 === 0 ? -2.2 : 2.2)])
  return ink.curve(pts, { roughness: 0.4, strokeWidth: 1.4, stroke: REVIEW_INK, ...o })
}

/** 오른쪽 위 모서리가 접힌 문서 */
export function doc(x: number, y: number, w: number, h: number, o?: Options): Drawable[] {
  const f = 18
  return [
    ink.poly(
      [
        [x, y],
        [x + w - f, y],
        [x + w, y + f],
        [x + w, y + h],
        [x, y + h],
      ],
      { fill: WASH.paper, fillStyle: 'solid', ...o },
    ),
    ink.open(
      [
        [x + w - f, y],
        [x + w - f, y + f],
        [x + w, y + f],
      ],
      { strokeWidth: 1.2 },
    ),
  ]
}

/** 원점(0,0)이 펜촉 끝이고 +x 방향으로 뻗은 만년필. 그룹의 transform으로 놓는다 */
export function fountainPen(scale = 1): Drawable[] {
  const s = (n: number) => n * scale
  return [
    ink.rect(s(40), s(-14), s(234), s(28), { stroke: 'none', fill: WASH.paper, fillStyle: 'solid', roughness: 0.3 }),
    ink.poly(
      [
        [0, 0],
        [s(30), s(-9)],
        [s(40), s(-8)],
        [s(40), s(8)],
        [s(30), s(9)],
      ],
      { fill: WASH.paper, fillStyle: 'solid', strokeWidth: 1.5 },
    ),
    ink.line(s(2), 0, s(25), 0, { strokeWidth: 1.1, roughness: 0.6 }),
    ink.circle(s(27), 0, s(4), { strokeWidth: 1.1, roughness: 0.5 }),
    ink.rect(s(40), s(-11), s(44), s(22), { fill: INK, fillStyle: 'hachure', hachureGap: 3.2, hachureAngle: 60 }),
    ink.rect(s(84), s(-14), s(190), s(28), { fill: INK, fillStyle: 'hachure', hachureGap: 5, hachureAngle: 75 }),
    ink.line(s(118), s(-14), s(118), s(14), { strokeWidth: 2.2 }),
    ink.line(s(122), s(-15), s(214), s(-15), { strokeWidth: 2 }),
  ]
}

export type { Drawable }
export const toPaths = (d: Drawable) => gen.toPaths(d)
