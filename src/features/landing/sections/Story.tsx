import { useRef, useState } from 'react'
import {
  type MotionValue,
  motion,
  useMotionValueEvent,
  
  useTransform,
} from 'motion/react'
import { useSectionProgress } from '../hooks/useSectionProgress'

/**
 * 레퍼런스: Apple AirPods 페이지의 sticky 캔버스 시퀀스 + 좌측 챕터 내비게이션.
 * 섹션 하나를 3개 챕터로 나누고, 챕터마다 다른 시퀀스를 스크럽한다.
 */
const CHAPTERS = [
  {
    title: '여러 창작자와 협업하고',
    body: '팀을 만들어서 여러 사람들과 함께 창작하세요.',
  },
  {
    title: '창작 자체에 집중하고',
    body: '창작 외의 작업은 Prolog 에게 맡기세요.',
  },
  {
    title: '설정과 정보는 한눈에',
    body: '설정과 캐릭터 정보, 이야기 전개는 Prolog가 한눈에 볼 수 있도록 정리해 줄 거에요.',
  },
]

export function Story() {
  const ref = useRef<HTMLElement>(null)
  const p = useSectionProgress(ref)
  const [active, setActive] = useState(0)
  useMotionValueEvent(p, 'change', (v) => setActive(Math.min(2, Math.floor(v * 3))))

  // 각 챕터 구간을 0~1로 정규화
  const s0 = useTransform(p, [0, 1 / 3], [0, 1])
  const s1 = useTransform(p, [1 / 3, 2 / 3], [0, 1])
  const s2 = useTransform(p, [2 / 3, 1], [0, 1])

  const talkOpacity = useTransform(p, [0.3, 0.36], [1, 0])
  const handOpacity = useTransform(p, [0.3, 0.36, 0.64, 0.7], [0, 1, 1, 0])
  const mockOpacity = useTransform(p, [0.64, 0.7], [0, 1])
  const mockY = useTransform(p, [0.64, 0.74], [60, 0])

  return (
    <section ref={ref} className="tale" id="story">
      <div className="tale__sticky">
        <div className="tale__text">
          <ol className="chapters">
            {CHAPTERS.map((c, i) => (
              <li key={c.title} className="chapter" data-active={active === i}>
                <div className="chapter__bar">
                  <motion.span style={{ scaleY: [s0, s1, s2][i] }} />
                </div>
                <div>
                  <h3>{c.title}</h3>
                  <p className="chapter__body">{c.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="tale__stage">
          <motion.div className="stage__layer" style={{ opacity: talkOpacity }}>
            <StageVideo name="talk" focusX={0.4} />
          </motion.div>
          <motion.div className="stage__layer" style={{ opacity: handOpacity }}>
            <StageVideo name="hand" focusX={0.35} />
          </motion.div>
          <motion.div className="stage__layer stage__layer--mock" style={{ opacity: mockOpacity }}>
            <motion.div style={{ y: mockY }} className="mock-wrap">
              <EditorMock progress={s2} />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/** public/landing/videos 의 원본 영상을 스크롤과 상관없이 반복 재생한다 */
function StageVideo({ name, focusX }: { name: string; focusX: number }) {
  return (
    <video
      className="stage__video"
      src={`${import.meta.env.BASE_URL}landing/videos/${name}.mp4`}
      style={{ objectPosition: `${focusX * 100}% 50%` }}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    />
  )
}

const LINES = [
  { w: 92, kind: 'h' },
  { w: 100 },
  { w: 86 },
  { w: 64, kind: 'accent' },
  { w: 96 },
  { w: 72 },
] as const

function Line({ i, w, kind, progress }: { i: number; w: number; kind?: string; progress: MotionValue<number> }) {
  const start = 0.08 + i * 0.1
  const scaleX = useTransform(progress, [start, start + 0.14], [0, 1])
  return (
    <motion.span
      className={`mock__line ${kind ? `mock__line--${kind}` : ''}`}
      style={{ width: `${w}%`, scaleX }}
    />
  )
}

function EditorMock({ progress }: { progress: MotionValue<number> }) {
  const chipOpacity = useTransform(progress, [0.7, 0.8], [0, 1])
  const chipY = useTransform(progress, [0.7, 0.8], [12, 0])
  return (
    <div className="mock" role="img" aria-label="Prolog 설정 정리 화면 예시">
      <div className="mock__bar">
        <i /> <i /> <i />
        <span className="mono">prolog.app / 잿빛 왕국 · 설정집</span>
      </div>
      <div className="mock__body">
        <aside className="mock__side">
          <p className="mono">WORLD</p>
          <span className="pill pill--ink">캐릭터 · 12명</span>
          <span className="pill pill--sky">세계관 설정 · 34개</span>
          <span className="pill pill--blue">전개 타임라인 · 5장</span>
        </aside>
        <div className="mock__doc">
          <p className="mock__title">아린 — 주인공 · 왕국의 기록관</p>
          {LINES.map((l, i) => (
            <Line key={i} i={i} w={l.w} kind={'kind' in l ? l.kind : undefined} progress={progress} />
          ))}
          <motion.div className="mock__chip" style={{ opacity: chipOpacity, y: chipY }}>
            <span className="sparkle">✦</span> 설정 충돌 1건 · 3장에서 아린의 나이가 달라요
          </motion.div>
        </div>
      </div>
    </div>
  )
}
