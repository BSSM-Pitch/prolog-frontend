import { useRef } from 'react'
import { motion, useTransform } from 'motion/react'
import { useSectionProgress } from '../hooks/useSectionProgress'
import { SequenceCanvas } from '../components/SequenceCanvas'
import { FRAMES } from '../frames'

/**
 * 레퍼런스: Apple 제품 페이지의 "카드 → 풀블리드" 확장.
 * 스크롤에 따라 헤드라인이 물러나고, 인셋 카드였던 영상이 화면 전체로 열린다.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const p = useSectionProgress(ref)

  // 1 = 카드, 0 = 풀블리드
  const open = useTransform(p, [0, 0.42], [1, 0], { clamp: true })
  const clipPath = useTransform(open, (v) => {
    const side = window.innerWidth < 720 ? 5 : 21
    return `inset(${v * 47}% ${v * side}% ${v * 5}% ${v * side}% round ${v * 28}px)`
  })
  const mediaScale = useTransform(p, [0, 0.42], [1.18, 1])
  const tint = useTransform(p, [0.3, 0.55], [0, 1])

  const headY = useTransform(p, [0, 0.35], ['0%', '-30%'])
  const headOpacity = useTransform(p, [0, 0.3], [1, 0])
  const headScale = useTransform(p, [0, 0.35], [1, 0.92])

  const copyOpacity = useTransform(p, [0.5, 0.62, 0.86, 0.96], [0, 1, 1, 0])
  const copyY = useTransform(p, [0.5, 0.62], [40, 0])
  const barScale = useTransform(p, [0, 1], [0, 1])

  return (
    <section ref={ref} className="hero" id="top">
      <div className="hero__sticky">
        <motion.div className="hero__head" style={{ y: headY, opacity: headOpacity, scale: headScale }}>
          <h1 className="hero__title">
            흐르는 대로
            <br />
            이야기를 써내려가세요.
          </h1>
          <p className="hero__sub">
            창작자들을 위한 지반이 다져져 있는 공간, Prolog 입니다.
          </p>
        </motion.div>

        <motion.div className="hero__media" style={{ clipPath }}>
          <motion.div className="hero__scale" style={{ scale: mediaScale }}>
            <SequenceCanvas {...FRAMES.hero} progress={p} eager className="seq" />
          </motion.div>
          <motion.div className="hero__tint" style={{ opacity: tint }} />
          <motion.div className="hero__copy" style={{ opacity: copyOpacity, y: copyY }}>
            <h2>창작에만 집중하세요</h2>
            <p>설정 오류와 잊을 것 같던 정보들을 간단히 확인할 수 있어요.</p>
          </motion.div>
        </motion.div>

        <div className="hero__progress" aria-hidden="true">
          <motion.span style={{ scaleX: barScale }} />
        </div>
      </div>
    </section>
  )
}
