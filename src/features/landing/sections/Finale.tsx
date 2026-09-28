import { useRef } from 'react'
import { motion, useTransform } from 'motion/react'
import { Link } from 'react-router-dom'
import { useSession } from '../../../auth/session'
import { useSectionProgress } from '../hooks/useSectionProgress'
import { SequenceCanvas } from '../components/SequenceCanvas'
import { FRAMES } from '../frames'

/**
 * 타자기 영상을 스크롤로 스크럽해 "FOLLOW US." 를 사용자가 직접 타이핑하게 만든다.
 * 타이핑이 끝나는 지점에서 CTA가 올라온다.
 */
export function Finale() {
  const ref = useRef<HTMLElement>(null)
  const p = useSectionProgress(ref)
  const signedIn = useSession().status === 'signed-in'
  // 세로 화면: 영상을 가로형 박스로 보여줘 타이핑되는 글자가 잘리지 않게 한다
  const isPortrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight
  // 영상 구간: 빈 종이(0~40프레임) → 타이핑(40~90) → 컷 전환·완성(90~155).
  // 빈 구간과 완성 구간은 빠르게 넘기고, 타이핑 구간에 스크롤 거리의 대부분을 배분한다.
  const frames = useTransform(p, [0, 0.06, 0.62, 0.74], [0, 40 / 155, 90 / 155, 1])
  // 영상 속 글자는 처음엔 왼쪽(0~28%)에, 컷 이후엔 가운데(30~62%)에 찍힌다.
  // 세로 화면에서는 크롭 위치를 그에 맞춰 옮겨 글자를 따라간다.
  const focusX = useTransform(frames, [0.62, 0.66], [0, 0.42])
  const scale = useTransform(p, [0, 0.74], [isPortrait ? 1.06 : 1.25, 1])
  const shade = useTransform(p, [0.7, 0.88], [0.15, 0.78])
  const ctaOpacity = useTransform(p, [0.76, 0.9], [0, 1])
  const ctaY = useTransform(p, [0.76, 0.9], [60, 0])

  return (
    <section ref={ref} className="finale" id="start">
      <div className="finale__sticky">
        <motion.div className="finale__media" style={{ scale }}>
          <SequenceCanvas {...FRAMES.type} progress={frames} className="seq" focusX={isPortrait ? focusX : 0.5} focusY={0.2} />
        </motion.div>
        <motion.div className="finale__shade" style={{ opacity: shade }} />

        <motion.div className="finale__cta" style={{ opacity: ctaOpacity, y: ctaY }}>
          <h2>
            첫 문장은,
            <br />
            지금 여기 Prolog 에서.
          </h2>
          <p>이어서 쓰던 문장이 기다리고 있어요.</p>
          {signedIn ? (
            <Link to="/projects" className="lbtn lbtn--blue lbtn--lg">
              이어서 쓰기
            </Link>
          ) : (
            <Link to="/auth/login" className="lbtn lbtn--blue lbtn--lg">
              로그인하기
            </Link>
          )}
        </motion.div>
      </div>
    </section>
  )
}
