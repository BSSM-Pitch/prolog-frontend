import { Link } from 'react-router-dom'
import { useSession } from '../../../auth/session'
import { VOICE } from '../../../content/voice'
import { HeroScene } from '../illustrations/HeroScene'

/** 1. 문구: 서비스의 약속 한 문장과 시작 버튼, 펼친 원고지 펜화 */
export function Statement() {
  const signedIn = useSession().status === 'signed-in'
  const { title, body } = VOICE.statement

  return (
    <section className="statement" id="top" aria-labelledby="statement-title">
      <div className="statement__copy">
        <h1 id="statement-title">
          {title.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h1>
        <p>{body}</p>
        <div className="statement__actions">
          <Link to={signedIn ? '/projects' : '/auth/signup'} className="lbtn lbtn--ink">
            {signedIn ? VOICE.cta.resume : VOICE.cta.start}
          </Link>
          <a href="#features" className="ink-link">
            {VOICE.cta.features}
          </a>
        </div>
      </div>
      <div className="statement__art">
        <HeroScene />
      </div>
    </section>
  )
}
