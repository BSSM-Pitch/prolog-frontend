import { Link } from 'react-router-dom'
import { useSession } from '../../../auth/session'
import { VOICE } from '../../../content/voice'
import './Hero.css'

// 책의 조판을 표현하는 장식용 창작 문장. 읽기 순서나 서비스 안내에는 포함하지 않는다.
const backdropPages = [
  [
    '아침이 오기 전, 창가에는 아직 어젯밤의 빛이 남아 있었다. 책상 위에 펼쳐 둔 종이의 모서리가 바람에 조금씩 들렸다. 서윤은 마지막으로 적은 문장을 다시 읽고, 그 아래에 다음 문장이 들어갈 자리를 남겨 두었다. 멀리서 첫 버스가 지나가는 소리가 들렸다.',
    '처음에는 작은 장면 하나였다. 문을 열고 들어오는 사람의 어깨, 의자에 걸쳐 놓은 외투, 말없이 건네는 물 한 잔. 따로 놓여 있던 것들이 한 문장 안에서 만나자 비로소 그날의 방이 보이기 시작했다. 누구도 설명하지 않았지만, 그곳에는 오래 기다린 사람의 시간이 있었다.',
    '서윤은 이름을 적었다가 지웠다. 이름보다 먼저 걸음걸이가 떠올랐고, 목소리보다 먼저 말을 고르는 버릇이 생각났다. 그렇게 한 사람을 알아 가는 동안 종이 위의 빈 곳이 조금씩 줄어들었다. 어떤 대목은 끝내 쓰지 못했지만, 지운 자리는 다음 문장의 길이가 되었다.',
    '점심이 지나자 창으로 들어오던 빛이 책상 반대편으로 옮겨 갔다. 그는 페이지를 넘겨 앞서 쓴 장면으로 돌아갔다. 첫 장에서 무심코 열어 둔 창문이 아직 닫히지 않았다는 것을 그때 알아차렸다. 창밖의 계절을 고치고 나니, 기다리던 사람이 할 말도 달라져 있었다.',
  ],
  [
    '길은 낮은 담장을 따라 이어졌다. 담장 너머에서는 보이지 않는 나무가 잎을 흔들고 있었다. 둘은 한동안 같은 속도로 걸었고, 갈림길에 이르러서야 서로 다른 곳을 생각하고 있었다는 것을 알았다. 먼저 멈춘 사람이 돌아보았다. 나중에 멈춘 사람은 주머니에서 손을 꺼냈다.',
    '이 장면을 어디에서 끝낼지 오래 생각했다. 인사를 나누는 곳에서도, 한 사람이 모퉁이를 돌아 사라지는 곳에서도 끝낼 수 있었다. 그러나 그는 남아 있는 사람의 발치에 시선을 두었다. 나뭇잎 하나가 신발 앞에 떨어졌고, 그 짧은 사이에 오후가 조금 더 깊어졌다.',
    '다시 책상 앞에 앉았을 때 방은 조용했다. 낮에 적어 둔 문장들이 낯설게 느껴져 천천히 소리 내어 읽었다. 급하게 지나간 곳에서는 숨이 찼고, 너무 오래 머문 곳에서는 말끝이 흐려졌다. 그는 쉼표 하나를 마침표로 바꾸었다. 그것만으로도 다음 장면까지 걸어갈 수 있을 것 같았다.',
    '마지막 장을 덮기 전에 첫 장을 한 번 더 펼쳤다. 처음에는 알지 못했던 것들이 이제는 문장 사이에 놓여 있었다. 돌아온 길과 돌아오지 않은 사람, 전하지 못한 말과 끝내 건넨 대답. 그는 맨 아래에 짧은 문장을 적었다. 창밖에서는 어느새 저녁을 준비하는 소리가 들려왔다.',
  ],
]

// 인물·배경 설정·원문 검토를 암시하는 정적인 시각 예시. 별도의 설명 UI는 더하지 않는다.
const backdropAnnotations: Record<string, 'character' | 'setting' | 'review'> = {
  서윤: 'character',
  창가: 'setting',
  갈림길: 'setting',
  '닫히지 않았다는': 'review',
}

function annotatedParagraph(paragraph: string) {
  return paragraph.split(/(서윤|창가|갈림길|닫히지 않았다는)/g).map((part, index) => {
    const kind = backdropAnnotations[part]
    return kind ? (
      <mark className={`writing-hero__annotation writing-hero__annotation--${kind}`} key={index}>
        {part}
      </mark>
    ) : (
      part
    )
  })
}

export function Hero() {
  const signedIn = useSession().status === 'signed-in'

  return (
    <section className="writing-hero" id="top" aria-labelledby="writing-hero-title">
      <div className="writing-hero__backdrop" aria-hidden="true">
        {backdropPages.map((paragraphs, page) => (
          <div className="writing-hero__page" key={page}>
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{annotatedParagraph(paragraph)}</p>
            ))}
          </div>
        ))}
      </div>
      <h1 id="writing-hero-title">{VOICE.hero.title}</h1>
      <Link to={signedIn ? '/projects' : '/auth/signup'} className="writing-hero__start">
        {signedIn ? VOICE.cta.resume : VOICE.cta.start}
      </Link>
    </section>
  )
}
