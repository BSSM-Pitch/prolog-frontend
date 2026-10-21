import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IconArrowUpRight } from '@tabler/icons-react'
import { useSession } from '../../../auth/session'

// 세로 스테퍼로 넘기는 세 장면. 왼쪽 원을 누르면 문구가 바뀐다
const SLIDES = [
  {
    step: '쓰기',
    title: ['흐르는 대로,', '이야기를 써내려가세요.'],
    body: '창작자를 위한 단단한 지반. 쓰는 일에만 집중하면 나머지는 Prolog가 정리해요.',
  },
  {
    step: '정리',
    title: ['인물과 세계는', '알아서 정리돼요.'],
    body: '원고를 올리면 인물, 관계, 세계 규칙이 한 권의 설정집으로 차곡차곡 쌓여요.',
  },
  {
    step: '검토',
    title: ['어긋난 설정은', '먼저 알려 드려요.'],
    body: '앞에서 정한 설정과 맞지 않는 문장을 근거와 함께 짚어 줘요. 고칠지는 작가가 정해요.',
  },
]

const AVATARS = ['김', 'J', '서']

export function Hero() {
  const signedIn = useSession().status === 'signed-in'
  const [active, setActive] = useState(0)
  const slide = SLIDES[active]

  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <div className="hero__card">
        <ol className="hero__stepper" aria-label="Prolog로 쓰는 세 단계">
          {SLIDES.map((s, i) => (
            <li key={s.step}>
              <button
                type="button"
                className="hero__step"
                aria-current={i === active ? 'step' : undefined}
                aria-label={`${i + 1}단계 ${s.step}`}
                onClick={() => setActive(i)}
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>

        <div className="hero__copy" aria-live="polite">
          <p className="eyebrow hero__eyebrow">Write with clarity · {slide.step}</p>
          <h1 id="hero-title" className="t-display hero__title">
            {slide.title[0]}
            <br />
            {slide.title[1]}
          </h1>
          <p className="hero__body">{slide.body}</p>
          <div className="hero__actions">
            <Link to={signedIn ? '/projects' : '/auth/signup'} className="btn btn--primary btn--lg">
              {signedIn ? '내 프로젝트로' : '무료로 시작하기'}
            </Link>
            <a href="#process" className="arrow-link hero__how">
              How it works
            </a>
          </div>
        </div>

        {/* 오른쪽 아래를 안쪽으로 파낸 자리 */}
        <div className="hero__notch">
          <div className="know">
            <div className="know__avatars" aria-hidden="true">
              {AVATARS.map((a) => (
                <span key={a}>{a}</span>
              ))}
            </div>
            <div className="know__text">
              <p className="know__title">베타 작가들과 함께 만드는 중</p>
              <a href="#about" className="arrow-link know__link">
                Know more
              </a>
            </div>
            <a href="#about" className="icon-btn icon-btn--filled" aria-label="Prolog 더 알아보기">
              <IconArrowUpRight size={20} stroke={1.75} />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
