import { IconFileUpload, IconListCheck, IconUsersGroup, type IconProps } from '@tabler/icons-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { Reveal } from '../Reveal'

const STEPS: { title: string; body: string; icon: ComponentType<IconProps>; active?: boolean }[] = [
  { title: '원고를 올려요', body: '쓰던 원고를 그대로 올리거나 빈 문서에서 시작해요.', icon: IconFileUpload },
  {
    title: '설정이 정리돼요',
    body: '인물, 관계, 세계 규칙, 복선이 설정집으로 쌓이고 어긋난 문장은 표시돼요.',
    icon: IconListCheck,
    active: true,
  },
  { title: '함께 다듬어요', body: '팀원을 초대해 같은 설정집을 보며 고쳐 나가요.', icon: IconUsersGroup },
]

export function Process() {
  return (
    <section id="process" className="section process" aria-labelledby="process-title">
      <Reveal className="section__head section__head--center">
        <p className="eyebrow">How it works</p>
        <h2 id="process-title" className="t-h2">
          세 단계면 충분해요
        </h2>
        <p className="t-body">설정 관리에 들이던 시간을 이야기에 돌려드릴게요.</p>
      </Reveal>

      <ol className="process__list">
        {STEPS.map((s, i) => (
          <li key={s.title} className={s.active ? 'step step--active' : 'step'}>
            <Reveal delay={i * 0.08} className="step__inner">
              {s.active && <span className="step__photo" aria-hidden="true" />}
              <span className="step__icon" aria-hidden="true">
                <s.icon size={22} stroke={1.75} />
              </span>
              <p className="step__num">Step 0{i + 1}</p>
              <h3 className="t-h3">{s.title}</h3>
              <p className="step__body">{s.body}</p>
              {s.active && (
                <Link to="/auth/signup" className="arrow-link step__link">
                  Learn more
                </Link>
              )}
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  )
}
