import { IconAlertTriangle, IconArrowLeft, IconArrowRight, IconRoute, IconSparkles, IconUsers, type IconProps } from '@tabler/icons-react'
import { useRef, type ComponentType } from 'react'
import { Reveal } from '../Reveal'

type Feature = {
  title: string
  body: string
  meta: string
  metaIcon: ComponentType<IconProps>
  badge: string
  /** 카드 이미지: 구름 사진 + 그 위에 뜬 작은 화면 조각 */
  sky: 'soft' | 'hero' | 'band'
  focus: string
  mock: 'character' | 'conflict' | 'foreshadow' | 'relation' | 'team'
}

const FEATURES: Feature[] = [
  {
    title: '자연어 캐릭터 설계',
    body: '캐릭터를 문장으로 설명하면 정보가 자동으로 정리되고, 언제든 고칠 수 있어요.',
    meta: '문장 한 줄로 시작',
    metaIcon: IconSparkles,
    badge: 'AI',
    sky: 'soft',
    focus: '30% 60%',
    mock: 'character',
  },
  {
    title: '설정 충돌 감지',
    body: '설정에 어긋나는 문장을 쓰면 근거와 함께 짚어 줘요.',
    meta: '원고 전체를 검토',
    metaIcon: IconAlertTriangle,
    badge: '자동',
    sky: 'hero',
    focus: '20% 80%',
    mock: 'conflict',
  },
  {
    title: '복선 추적',
    body: '어디서 복선을 심고 거두었는지 장면 단위로 정리해 줘요.',
    meta: '심은 곳 · 거둔 곳',
    metaIcon: IconRoute,
    badge: '정리',
    sky: 'band',
    focus: '70% 40%',
    mock: 'foreshadow',
  },
  {
    title: '관계 변화 시각화',
    body: '인물 사이의 관계가 장마다 어떻게 바뀌는지 한눈에 보여 줘요.',
    meta: '장별 흐름',
    metaIcon: IconRoute,
    badge: '한눈에',
    sky: 'soft',
    focus: '80% 30%',
    mock: 'relation',
  },
  {
    title: '함께 쓰기',
    body: '팀을 만들어 같은 설정집을 보며 피드백을 주고받아요.',
    meta: '역할별 권한',
    metaIcon: IconUsers,
    badge: '팀',
    sky: 'hero',
    focus: '85% 70%',
    mock: 'team',
  },
]

export function Features() {
  const track = useRef<HTMLUListElement>(null)
  const scrollBy = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const card = el.querySelector('li')
    el.scrollBy({ left: dir * ((card?.clientWidth ?? 360) + 32), behavior: 'smooth' })
  }

  return (
    <section id="about" className="section about" aria-labelledby="about-title">
      <Reveal className="section__head">
        <div>
          <p className="eyebrow">About Prolog</p>
          <h2 id="about-title" className="t-h2">
            창작에만 집중하세요
          </h2>
        </div>
        <div className="section__aside">
          <p className="t-body">설정 오류와 잊을 것 같던 정보를 간단히 확인할 수 있어요. 창작 외의 일은 Prolog에게 맡기세요.</p>
          <div className="section__arrows">
            <button type="button" className="icon-btn" aria-label="이전 기능" onClick={() => scrollBy(-1)}>
              <IconArrowLeft size={20} stroke={1.75} />
            </button>
            <button type="button" className="icon-btn icon-btn--filled" aria-label="다음 기능" onClick={() => scrollBy(1)}>
              <IconArrowRight size={20} stroke={1.75} />
            </button>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <ul id="features" ref={track} className="cards" aria-label="Prolog가 할 수 있는 것들">
          {FEATURES.map((f) => (
            <li key={f.title} className="card">
              <div className="card__media" style={{ backgroundImage: `url(/brand/clouds/sky-${f.sky}.webp)`, backgroundPosition: f.focus }}>
                <Mock kind={f.mock} />
              </div>
              <div className="card__row">
                <h3 className="t-h3">{f.title}</h3>
                <span className="card__badge">★ {f.badge}</span>
              </div>
              <p className="card__meta">
                <f.metaIcon size={14} stroke={1.75} aria-hidden="true" />
                {f.meta}
              </p>
              <p className="card__body">{f.body}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  )
}

/** 카드 이미지 위의 작은 화면 조각. 장식이라 스크린 리더에서는 숨긴다 */
function Mock({ kind }: { kind: Feature['mock'] }) {
  switch (kind) {
    case 'character':
      return (
        <div className="mock" aria-hidden="true">
          <span className="mock__avatar">아</span>
          <div>
            <p className="mock__title">아린</p>
            <p className="mock__sub">주인공 · 왕국의 기록관</p>
          </div>
        </div>
      )
    case 'conflict':
      return (
        <div className="mock mock--col" aria-hidden="true">
          <span className="mock__chip mock__chip--danger">충돌 1건</span>
          <p className="mock__title">3장 ↔ 설정 #12</p>
          <p className="mock__sub">“기록관은 왕궁 밖으로 나갈 수 없다”</p>
        </div>
      )
    case 'foreshadow':
      return (
        <div className="mock mock--col" aria-hidden="true">
          <p className="mock__sub">은빛 열쇠</p>
          <div className="mock__track">
            <span className="is-on" />
            <i />
            <span />
          </div>
          <p className="mock__title">2장에서 심음 · 회수 전</p>
        </div>
      )
    case 'relation':
      return (
        <div className="mock" aria-hidden="true">
          <span className="mock__avatar">아</span>
          <span className="mock__line" />
          <span className="mock__avatar mock__avatar--dark">카</span>
          <p className="mock__sub">동료 → 적</p>
        </div>
      )
    case 'team':
      return (
        <div className="mock" aria-hidden="true">
          <div className="mock__stack">
            <span className="mock__avatar">김</span>
            <span className="mock__avatar">J</span>
            <span className="mock__avatar mock__avatar--dark">+3</span>
          </div>
          <p className="mock__title">잿빛 왕국 팀</p>
        </div>
      )
  }
}
