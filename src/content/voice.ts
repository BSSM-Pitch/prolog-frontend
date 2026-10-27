/** Prolog의 목소리: 작가 곁의 조용한 편집자. */
export const VOICE = {
  title: 'Prolog — 당신의 다음 문장을 위해',
  description: '원고와 인물, 세계관을 함께 살피는 집필 공간. Prolog에서 당신의 이야기를 이어 가세요.',
  navigation: [
    { href: '#about', label: 'Prolog의 약속' },
    { href: '#story', label: '집필의 흐름' },
    { href: '#features', label: '이야기의 도구' },
  ],
  cta: { start: '첫 문장 쓰기', resume: '이어서 쓰기', library: '내 서재' },
  hero: {
    title: '한 편을 끝까지.',
  },
  manifesto: '당신만이 쓸 수 있는 이야기가 있어요. Prolog는 그 이야기가 끝까지 이어지도록 곁을 지켜요.',
  chapters: [
    { title: '함께 쓰는 장면', body: '동료를 초대하고, 같은 작품의 다음 장을 함께 써요.' },
    { title: '다음 문장에 집중하고', body: '써 둔 원고를 가져오거나, 빈 페이지에서 시작해 보세요.' },
    { title: '이야기의 약속을 기억해요', body: '인물과 세계관을 모아 보고, 앞선 장면과 다른 설정을 살펴요.' },
  ],
  tools: {
    title: '이야기를 이어 주는 도구들',
    character: {
      title: '문장으로 인물 그리기',
      body: '떠오르는 모습을 적으면 인물 초안으로 정리해요. 무엇을 남길지는 작가가 정해요.',
    },
    conflict: {
      title: '설정 사이의 빈틈 찾기',
      body: '앞선 장면과 다른 설정을 짚어요. 원문을 살펴보고 이야기의 방향을 정해 주세요.',
    },
    collab: {
      title: '함께 다음 장 쓰기',
      body: '동료를 초대해 원고를 나눠요. 함께 쓸 사람과 읽어 줄 사람의 역할을 정할 수 있어요.',
    },
  },
  finale: { lead: '이제, 당신의', title: '다음 문장을 만나 볼까요.', description: '한 문장부터, 당신의 속도로.' },
  auth: { login: '이어서 쓸 이야기가 기다려요', signup: '당신의 이야기를 시작해요' },
  library: {
    description: '쓰고 있는 이야기들을 한곳에 모았어요.',
    empty: '아직 펼치지 않은 이야기가 있어요',
    next: '새 작품을 만들고 첫 문장을 적어 보세요.',
  },
} as const
