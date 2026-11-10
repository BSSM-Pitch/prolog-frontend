import { Figure, Note, Strokes } from '../components/ink/Figure'
import { MUTED, REVIEW_INK, WASH, doc, ink, scribble, wavy } from '../components/ink/rough'

// 쓰기 전의 문제 네 장면. 예시는 데모 작품 「붉은 문 너머」(src/api/mock/demo.ts)의 실제 어긋남이다.
const W = 360
const H = 240

/* 1. 흩어진 설정: 휴대폰 메모, 연표 시트, 노트 귀퉁이의 포스트잇 */
const phone = [
  ink.rect(22, 34, 86, 170, { fill: WASH.paper, fillStyle: 'solid', strokeWidth: 1.8 }),
  ink.rect(30, 54, 70, 128, { strokeWidth: 1.1, stroke: MUTED }),
  ink.line(56, 194, 74, 194, { strokeWidth: 1.6 }),
]
const sheet = [
  ink.rect(134, 22, 206, 118, { fill: WASH.sheet, fillStyle: 'solid' }),
  ink.line(134, 52, 340, 52, { strokeWidth: 1.1 }),
  ink.line(134, 82, 340, 82, { strokeWidth: 1.1, stroke: MUTED }),
  ink.line(134, 112, 340, 112, { strokeWidth: 1.1, stroke: MUTED }),
  ink.line(184, 22, 184, 140, { strokeWidth: 1.1 }),
]
const sticky = [
  ink.rect(-64, -34, 128, 68, { fill: WASH.setting, fillStyle: 'solid', strokeWidth: 1.5 }),
  ink.line(-64, -24, 64, -24, { strokeWidth: 0.9, stroke: MUTED }),
]

export function ScatteredScene() {
  return (
    <Figure w={W} h={H} replay label="휴대폰 메모, 연표 시트, 포스트잇에 나뉘어 적힌 설정">
      <Strokes shapes={sheet} step={0.12} />
      <Note x={142} y={32} size={12}>장</Note>
      <Note x={194} y={32} size={12}>사건</Note>
      <Note x={142} y={62} size={12} delay={0.6}>8장</Note>
      <Note x={194} y={62} size={12} delay={0.6}>북쪽 승강장 폐쇄</Note>
      <Note x={142} y={92} size={12} delay={0.8}>17장</Note>
      <Note x={194} y={92} size={12} delay={0.8}>규칙 17 공개</Note>
      <Strokes shapes={phone} delay={0.3} step={0.15} />
      <Note x={38} y={64} size={12} width={58} delay={0.9}>
        민아
        <br />
        열일곱?
        <br />
        열아홉?
      </Note>
      <Strokes shapes={sticky} delay={0.8} transform="translate(246 184) rotate(-7)" />
      <Note x={246} y={188} size={12} width={112} rotate={-7} center delay={1.2}>
        규칙 17은 노트 어딘가에…
      </Note>
    </Figure>
  )
}

/* 2. 바뀌는 사실: 8장과 26장의 폐쇄 연도 */
const pages = [...doc(16, 18, 150, 204), ...doc(194, 18, 150, 204)]
const years = [
  ink.ellipse(78, 162, 112, 58, { stroke: REVIEW_INK, strokeWidth: 1.8 }),
  ink.ellipse(256, 162, 112, 58, { stroke: REVIEW_INK, strokeWidth: 1.8 }),
  ink.curve(
    [
      [128, 140],
      [180, 112],
      [208, 138],
    ],
    { stroke: REVIEW_INK, strokeWidth: 1.5 },
  ),
  ink.open(
    [
      [196, 132],
      [208, 138],
      [206, 124],
    ],
    { stroke: REVIEW_INK, strokeWidth: 1.5 },
  ),
]

export function FactsScene() {
  return (
    <Figure w={W} h={H} replay label="8장에는 1998년, 26장에는 2001년으로 적힌 승강장 폐쇄 연도">
      <Strokes shapes={pages} step={0.2} />
      <Note x={30} y={34} size={15} delay={0.4}>8장</Note>
      <Note x={208} y={34} size={15} delay={0.4}>26장</Note>
      <Note x={30} y={64} size={11.5} width={124} delay={0.7}>
        북쪽 승강장은 이 해에 폐쇄됐다.
      </Note>
      <Note x={208} y={64} size={11.5} width={124} delay={0.9}>
        역무원은 이 해에 문을 닫았다고 기억했다.
      </Note>
      <Note x={78} y={162} size={26} center delay={1.3} className="ink-note--review">
        1998
      </Note>
      <Note x={256} y={162} size={26} center delay={1.5} className="ink-note--review">
        2001
      </Note>
      <Strokes shapes={years} delay={1.8} step={0.25} />
    </Figure>
  )
}

/* 3. 흔들리는 인물: 민아의 사진과 장마다 다른 나이 */
const portrait = [
  ink.rect(26, 26, 126, 168, { fill: WASH.paper, fillStyle: 'solid', strokeWidth: 1.8 }),
  ink.rect(38, 38, 102, 118, { fill: WASH.character, fillStyle: 'solid', strokeWidth: 1.1 }),
  ink.circle(89, 86, 42, { fill: WASH.paper, fillStyle: 'solid' }),
  ink.path('M60 64 C 66 40, 112 40, 118 64 C 120 80, 116 96, 112 102 L 108 80 C 100 70, 78 70, 70 80 L 66 102 C 60 94, 58 78, 60 64 Z', {
    fill: 'var(--itda-ink)',
    fillStyle: 'hachure',
    hachureGap: 3.4,
    strokeWidth: 1.4,
  }),
  ink.path('M50 156 C 54 120, 124 120, 128 156', { fill: 'var(--itda-ink)', fillStyle: 'hachure', hachureGap: 5, strokeWidth: 1.6 }),
  ink.rect(66, 16, 46, 18, { stroke: 'none', fill: MUTED, fillStyle: 'hachure', hachureGap: 3.2, fillWeight: 0.7 }),
]
const ages = [wavy(184, 92, 140), wavy(184, 160, 140)]

export function PeopleScene() {
  return (
    <Figure w={W} h={H} replay label="2장에서는 열일곱, 21장에서는 열아홉으로 적힌 민아의 나이">
      <Strokes shapes={portrait} step={0.18} />
      <Note x={89} y={175} size={15} center delay={1.1}>
        민아
      </Note>
      <Note x={184} y={58} size={16} width={170} delay={1.2}>
        2장 — 열일곱
      </Note>
      <Note x={184} y={126} size={16} width={170} delay={1.6}>
        21장 — 열아홉
      </Note>
      <Strokes shapes={ages} delay={2.2} step={0.3} />
      <Note x={300} y={202} size={24} center delay={2.6} className="ink-note--review">
        ?
      </Note>
    </Figure>
  )
}

/* 4. 엇갈리는 원고: 이름만 다른 세 파일 */
const files = [
  ...doc(20, 20, 112, 132),
  ...doc(48, 52, 112, 132),
  ...doc(76, 84, 112, 132),
  ...scribble(90, 136, 80),
  ...scribble(90, 160, 84),
  ...scribble(90, 184, 52),
]
const leaders = [
  ink.line(116, 30, 202, 42, { strokeWidth: 1.1, stroke: MUTED }),
  ink.line(150, 68, 202, 106, { strokeWidth: 1.1, stroke: MUTED }),
  ink.line(178, 100, 202, 170, { strokeWidth: 1.1, stroke: MUTED }),
]

export function FilesScene() {
  return (
    <Figure w={W} h={H} replay label="최종, 진짜 최종, 최종(2)로 이름만 다른 원고 파일 세 개">
      <Strokes shapes={files} step={0.1} />
      <Strokes shapes={leaders} delay={1} step={0.2} />
      <Note x={208} y={32} size={12} width={150} delay={1.2}>
        붉은문_최종.docx
      </Note>
      <Note x={208} y={96} size={12} width={150} delay={1.5}>
        붉은문_진짜최종.docx
      </Note>
      <Note x={208} y={160} size={12} width={150} delay={1.8} className="ink-note--review">
        붉은문_최종(2).docx
      </Note>
    </Figure>
  )
}
