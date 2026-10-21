import { IconCheck } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { useSession } from '../../../auth/session'
import { Reveal } from '../Reveal'

const PERKS = ['모든 기능을 제한 없이', '개인·팀 프로젝트 모두', '언제든 원고 내보내기']

export function Promo() {
  const signedIn = useSession().status === 'signed-in'
  return (
    <section id="start" className="section promo" aria-labelledby="promo-title">
      <Reveal className="promo__box">
        <p className="eyebrow">Beta offer</p>
        <p className="promo__big">
          0<span>원</span>
        </p>
        <p className="t-caption">정식 출시 전 베타 기간 동안</p>
      </Reveal>
      <Reveal className="promo__copy" delay={0.08}>
        <p className="eyebrow">Elevate your writing</p>
        <h2 id="promo-title" className="t-h2">
          지금은 베타라서,
          <br />
          모든 기능이 무료예요
        </h2>
        <ul className="promo__perks">
          {PERKS.map((p) => (
            <li key={p}>
              <IconCheck size={16} stroke={2} aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
        <Link to={signedIn ? '/projects' : '/auth/signup'} className="btn btn--primary btn--lg">
          {signedIn ? '내 프로젝트로' : '무료로 시작하기'}
        </Link>
      </Reveal>
    </section>
  )
}
