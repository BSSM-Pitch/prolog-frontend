import { useRef } from 'react'
import { type MotionValue, motion, useTransform } from 'motion/react'
import { useSectionProgress } from '../hooks/useSectionProgress'

/** 레퍼런스: Linear / Apple 의 단어 단위 스크롤 리빌 */
const TEXT =
  '모든 좋은 글에는 첫 문장이 있습니다. Prolog는 그 시작을 함께 씁니다.'

const WORDS = TEXT.split(' ')

function Word({
  text,
  range,
  progress,
}: {
  text: string
  range: [number, number]
  progress: MotionValue<number>
}) {
  const opacity = useTransform(progress, range, [0.14, 1])
  return (
    <span className="word">
      <motion.span style={{ opacity }}>{text}</motion.span>{' '}
    </span>
  )
}

export function Manifesto() {
  const ref = useRef<HTMLElement>(null)
  const scrollYProgress = useSectionProgress(ref, ['start 0.75', 'end 0.55'])

  return (
    <section ref={ref} className="manifesto" id="about">
      <p className="manifesto__text" aria-label={TEXT}>
        {WORDS.map((w, i) => {
          const start = i / WORDS.length
          return (
            <Word
              key={i}
              text={w}
              progress={scrollYProgress}
              range={[start, start + 1 / WORDS.length]}
            />
          )
        })}
      </p>
    </section>
  )
}
