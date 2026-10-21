import { IconBook2, IconDeviceMobile, IconMovie } from '@tabler/icons-react'

// 실존 회사 로고 대신, Prolog로 쓰는 글의 형식을 회색 워드마크로 나열한다
const FORMATS = ['웹소설', '장편소설', '시나리오', '웹툰 스토리', 'TRPG 캠페인']

export function MadeFor() {
  return (
    <section className="madefor" aria-label="이런 글을 쓰는 작가를 위해">
      <div className="madefor__pill">
        <span>Made for</span>
        <span className="madefor__icons" aria-hidden="true">
          <IconBook2 size={16} stroke={1.75} />
          <IconMovie size={16} stroke={1.75} />
          <IconDeviceMobile size={16} stroke={1.75} />
        </span>
      </div>
      <ul className="madefor__list">
        {FORMATS.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </section>
  )
}
