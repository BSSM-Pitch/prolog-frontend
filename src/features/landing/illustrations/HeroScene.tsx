import type { CSSProperties } from 'react'
import { Figure, Layer, Mark, Note, Strokes } from '../components/ink/Figure'
import { MUTED, WASH, fountainPen, ink, scribble } from '../components/ink/rough'

// 데모 작품 「붉은 문 너머」 22장을 펼친 원고지. 옆에 붙은 포스트잇이 바람에 살짝 날리고,
// 만년필이 포스트잇 아래쪽에 메모를 적어 넣는다.
const W = 640
const H = 560

const shadow = [
  ink.rect(96, 62, 420, 452, { stroke: 'none', fill: MUTED, fillStyle: 'hachure', hachureGap: 8, fillWeight: 0.8 }),
]
const page = [
  ink.rect(72, 40, 420, 452, { fill: WASH.paper, fillStyle: 'solid', strokeWidth: 1.9 }),
  ink.line(104, 112, 458, 112, { strokeWidth: 1.2, stroke: MUTED }),
]
const lines = [...scribble(104, 344, 352), ...scribble(104, 382, 340), ...scribble(104, 420, 196)]

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
const label = onNote(0, -16)
const memo = onNote(0, 33)
/** 펜촉이 지나가는 메모 줄: 왼쪽 끝에서 오른쪽 끝까지 */
const MEMO_W = 88
const nibFrom = onNote(-MEMO_W / 2, 40)
const nibTo = onNote(MEMO_W / 2, 40)
/** 포스트잇이 매달린 테이프 자리(흔들림의 축) */
const tape = onNote(0, -60)

const pen = fountainPen(0.55)

/* 시간표(초) */
const PEN_IN = 2.3
const WRITE_AT = 3.5
const WRITE_FOR = 3.2
const FLUTTER_AT = WRITE_AT + WRITE_FOR * 0.75

const pct = (n: number, of: number) => `${(n / of) * 100}%`
const vars = {
  '--note-origin': `${pct(tape.x, W)} ${pct(tape.y, H)}`,
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
        <Strokes shapes={page} delay={0.2} step={0.4} duration={1} />
        <Note x={104} y={64} size={24} width={360} delay={0.9}>
          22장 · 기록위원회 진입
        </Note>
        <Note x={104} y={138} size={22} width={356} delay={1.4} className="hero-scene__text">
          <Mark tone="character">윤서</Mark>는 <Mark tone="setting">규칙 17</Mark>을 알면서도 위원회 문을 열었다.{' '}
          <Mark tone="character">재현</Mark>이 건넨 열쇠는 아직 차가웠다. “규칙 17을 알면서 여기까지 왔어?” 재현의
          목소리에는 처음 듣는 날이 서 있었다.
        </Note>
        <Strokes shapes={lines} delay={3.6} step={0.07} duration={0.35} />
        <Layer className="hero-scene__note">
          <Strokes
            shapes={note}
            delay={1.1}
            step={0.3}
            duration={0.6}
            transform={`translate(${NOTE.x} ${NOTE.y}) rotate(${NOTE.deg})`}
          />
          <Note x={label.x} y={label.y} size={15} width={120} rotate={NOTE.deg} center delay={1.7}>
            <b>재현</b>
            <br />
            열쇠를 맡은
            <br />
            기록관
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
            12장 · 열쇠 받음
          </Note>
        </Layer>
        <Layer className="hero-scene__pen">
          <Strokes
            shapes={pen}
            delay={PEN_IN}
            step={0.1}
            duration={0.5}
            transform={`translate(${nibFrom.x} ${nibFrom.y}) rotate(-48)`}
          />
        </Layer>
      </Figure>
    </div>
  )
}
