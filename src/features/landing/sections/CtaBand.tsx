import { IconArrowRight } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { useSession } from '../../../auth/session'
import { Reveal } from '../Reveal'

export function CtaBand() {
  const signedIn = useSession().status === 'signed-in'
  return (
    <section className="section cta" aria-labelledby="cta-title">
      <Reveal className="cta__band">
        <p className="eyebrow cta__eyebrow">Your first sentence awaits</p>
        <h2 id="cta-title" className="t-display-caps cta__title">
          Start your story
        </h2>
        <p className="cta__body">이어서 쓰던 문장이 기다리고 있어요.</p>
        <Link
          to={signedIn ? '/projects' : '/auth/signup'}
          className="icon-btn icon-btn--filled cta__go"
          aria-label={signedIn ? '내 프로젝트로' : '회원가입하고 시작하기'}
        >
          <IconArrowRight size={22} stroke={1.75} />
        </Link>
      </Reveal>
    </section>
  )
}
