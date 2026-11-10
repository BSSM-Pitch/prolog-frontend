import type { CSSProperties } from 'react'
import { Figure, Layer, Mark, Note, Strokes } from '../components/ink/Figure'
import { MUTED, WASH, fountainPen, ink, scribble } from '../components/ink/rough'

// 누구나 아는 「신데렐라」 12장을 펼친 원고지. 원고지와 옆에 붙은 포스트잇이 바람에 살짝 날리고,
// 만년필이 첫 화면이 뜨자마자 포스트잇 아래쪽에 메모를 적어 넣는다.
const W = 640
const H = 560

const shadow = [
  ink.rect(96, 62, 420, 452, { stroke: 'none', fill: MUTED, fillStyle: 'hachure', hachureGap: 8, fillWeight: 0.8 }),
]
const page = [
  ink.rect(72, 40, 420, 452, { fill: WASH.paper, fillStyle: 'solid', strokeWidth: 1.9 }),
  ink.line(104, 112, 458, 112, { strokeWidth: 1.2, stroke: MUTED }),
]
const lines = [...scribble(104, 372, 352), ...scribble(104, 410, 340), ...scribble(104, 448, 196)]

/* 포스트잇: 중심 (546, 168), 6° 기울임. 안쪽 좌표 (x, y)를 그림 좌표로 바꾼다 */
const NOTE = { x: 546, y: 168, deg: 6 }
const rad = (NOTE.deg * Math.PI) / 180
const onNote = (x: number, y: number) => ({
  x: NOTE.x + x * Math.cos(rad) - y * Math.sin(rad),
  y: NOTE.y + x * Math.sin(rad) + y * Math.cos(rad),
})
const note = [
  ink.rect(-74, -58, 148, 116, { fill: WASH.character, fillStyle: 'solid', strokeWidth: 1.5 }),
  ink.rect(-30, -70, 60, 22, { stroke: 'none', fill: MUTED, fillStyle: 'hachure', hachureGap: 3.5, fillWeight: 0.7 }),
]
const label = onNote(0, -24)
const memo = onNote(0, 34)
/** 펜촉이 지나가는 메모 줄: 왼쪽 끝에서 오른쪽 끝까지 */
const MEMO_W = 88
const nibFrom = onNote(-MEMO_W / 2, 41)
const nibTo = onNote(MEMO_W / 2, 41)
/** 포스트잇이 매달린 테이프 자리(흔들림의 축) */
const tape = onNote(0, -60)
/** 원고지 윗변 가운데(원고지 흔들림의 축) */
const PAGE_TOP = { x: 282, y: 40 }

const pen = fountainPen(0.55)

/* 시간표(초): 포스트잇과 펜을 먼저 그려 펜이 곧바로 쓰기 시작하게 한다 */
const NOTE_AT = 0.05
const PEN_IN = 0.1
const WRITE_AT = 0.75
const WRITE_FOR = 3.2
const FLUTTER_AT = WRITE_AT + WRITE_FOR * 0.75

const pct = (n: number, of: number) => `${(n / of) * 100}%`
const vars = {
  '--note-origin': `${pct(tape.x, W)} ${pct(tape.y, H)}`,
  '--page-origin': `${pct(PAGE_TOP.x, W)} ${pct(PAGE_TOP.y, H)}`,
  '--pen-dx': pct(nibTo.x - nibFrom.x, W),
  '--pen-dy': pct(nibTo.y - nibFrom.y, H),
  '--write-at': `${WRITE_AT}s`,
  '--write-for': `${WRITE_FOR}s`,
  '--flutter-at': `${FLUTTER_AT}s`,
} as CSSProperties

export function HeroScene() {
  return (
    <div className="hero-scene__wrap" style={vars}>
      <Figure w={W} h={H} className="hero-scene" eager>
        <Strokes shapes={shadow} delay={0.1} duration={1.2} />
        <Layer className="hero-scene__page">
          <Strokes shapes={page} delay={0.2} step={0.4} duration={1} />
          <Note x={104} y={64} size={24} width={360} delay={0.9}>
            12장 · 자정의 계단
          </Note>
          <Note x={104} y={138} size={22} width={356} delay={1.4} className="hero-scene__text">
            <Mark tone="character">신데렐라</Mark>는 <Mark tone="setting">자정</Mark>이 지나면 마법이 풀린다는 걸
            알면서도 마지막 춤을 추었다. 종이 울리자 계단을 뛰어 내려갔고 유리구두 한 짝이 벗겨졌다.{' '}
            <Mark tone="character">왕자</Mark>가 그 구두를 주워 들었다.
          </Note>
          <Strokes shapes={lines} delay={3.6} step={0.07} duration={0.35} />
        </Layer>
        <Layer className="hero-scene__note">
          <Strokes
            shapes={note}
            delay={NOTE_AT}
            step={0.2}
            duration={0.45}
            transform={`translate(${NOTE.x} ${NOTE.y}) rotate(${NOTE.deg})`}
          />
          <Note
            x={label.x}
            y={label.y}
            size={15}
            width={120}
            rotate={NOTE.deg}
            center
            delay={0.5}
            className="hero-scene__label"
          >
            <b>왕자</b>
            <br />
            무도회의 주인
          </Note>
          <Note
            x={memo.x}
            y={memo.y}
            size={13}
            width={MEMO_W}
            rotate={NOTE.deg}
            center
            delay={WRITE_AT}
            className="hero-scene__memo"
          >
            12장 · 구두 주움
          </Note>
        </Layer>
        <Layer className="hero-scene__pen">
          <Strokes
            shapes={pen}
            delay={PEN_IN}
            step={0.05}
            duration={0.3}
            transform={`translate(${nibFrom.x} ${nibFrom.y}) rotate(-48)`}
          />
        </Layer>
      </Figure>
    </div>
  )
}
