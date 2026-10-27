import { useRef, useState } from 'react'
import { type MotionValue, motion, useMotionValueEvent, useTransform } from 'motion/react'
import { useSectionProgress } from '../hooks/useSectionProgress'
import { VOICE } from '../../../content/voice'

/**
 * 레퍼런스: Apple AirPods 페이지의 sticky 캔버스 시퀀스 + 좌측 챕터 내비게이션.
 * 섹션 하나를 3개 챕터로 나누고, 챕터마다 다른 시퀀스를 스크럽한다.
 */
const CHAPTERS = VOICE.chapters

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

function EditorMock({ progress }: { progress: MotionValue<number> }) {
  const chipOpacity = useTransform(progress, [0.7, 0.8], [0, 1])
  const chipY = useTransform(progress, [0.7, 0.8], [12, 0])
  return (
    <div className="mock" role="img" aria-label="Prolog 집필 화면 예시">
      <div className="mock__bar">
        <span className="mono">잿빛 왕국 · 집필 화면 예시</span>
      </div>
      <div className="mock__body">
        <aside className="mock__side">
          <p className="mono">이야기의 기록</p>
          <span className="pill pill--ink">등장인물</span>
          <span className="pill pill--sky">세계관</span>
        </aside>
        <div className="mock__doc">
          <p className="mock__title">아직 부치지 못한 편지</p>
          <p className="mock__excerpt">
            아린은 편지를 접지 못했다. 창밖으로 마지막 불빛이 지나갔고, 끝내 쓰지 못한 이름 하나가 종이 위에 남았다.
          </p>
          <motion.div className="mock__chip" style={{ opacity: chipOpacity, y: chipY }}>
            앞선 장면의 인물 설정도 함께 살펴보세요.
          </motion.div>
        </div>
      </div>
    </div>
  )
}
