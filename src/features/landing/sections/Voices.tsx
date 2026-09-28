const QUOTES = [
  { q: '인터뷰 녹음 정리에 하루를 썼는데, 이제는 커피 한 잔이면 끝나요.', who: '김서연', role: 'UX 리서처' },
  { q: '손으로 쓴 강의 노트가 검색된다는 게 아직도 신기합니다.', who: '박지훈', role: '대학원생' },
  { q: '문체를 망가뜨리지 않는 AI는 처음이에요. 제 글 그대로, 더 선명하게.', who: '이도윤', role: '에세이스트' },
  { q: '팀 회의록이 알아서 쌓이고, 알아서 연결됩니다.', who: '최하은', role: 'PM · 핀테크' },
  { q: '글쓰기 도구를 바꾼 게 아니라 글 쓰는 습관이 바뀌었어요.', who: '정민재', role: '테크 블로거' },
  { q: '기획서 초안이 30분 만에 나옵니다. 진짜로요.', who: '한유진', role: '마케터' },
]

function Row({ reverse = false }: { reverse?: boolean }) {
  const items = reverse ? [...QUOTES].reverse() : QUOTES
  return (
    <div className="marquee" data-reverse={reverse}>
      {/* 끊김 없는 루프를 위해 두 번 렌더 */}
      {[0, 1].map((k) => (
        <div className="marquee__group" key={k} aria-hidden={k === 1}>
          {items.map((t) => (
            <figure className="quote" key={t.who}>
              <blockquote>“{t.q}”</blockquote>
              <figcaption>
                <span className="avatar">{t.who[0]}</span>
                <span>
                  <strong>{t.who}</strong>
                  <small>{t.role}</small>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      ))}
    </div>
  )
}

export function Voices() {
  return (
    <section className="voices" id="voices">
      <div className="voices__head">
        <p className="mono label">VOICES</p>
        <h2>먼저 써본 사람들의 문장.</h2>
      </div>
      <Row />
      <Row reverse />
    </section>
  )
}
