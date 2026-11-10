/** Prolog의 목소리: 작가 곁의 조용한 편집자. */
export const VOICE = {
  title: 'Prolog — 당신의 다음 문장을 위해',
  description: '원고와 인물, 세계관을 함께 살피는 집필 공간. Prolog에서 당신의 이야기를 이어 가세요.',
  navigation: [
    { href: '#problem', label: '쓰던 날들' },
    { href: '#features', label: '도구' },
    { href: '#start', label: '시작하기' },
  ],
  cta: { start: '첫 문장 쓰기', resume: '이어서 쓰기', library: '내 서재', features: '도구 살펴보기' },
  statement: {
    title: ['이야기는 길고,', '기억은 짧으니까.'],
    body: '원고와 인물, 세계관을 한곳에 두고 한 편을 끝까지 써요.',
  },
  problems: {
    title: 'Prolog 없이 쓰던 날들',
    lead: '장이 늘어날수록, 써 둔 이야기를 다시 찾는 시간이 길어져요.',
    items: [
      {
        key: 'scattered',
        title: '설정이 여기저기 흩어져요',
        body: '인물 메모는 휴대폰에, 연표는 스프레드시트에, 규칙은 노트 귀퉁이에. 필요한 순간에는 늘 다른 곳에 있어요.',
      },
      {
        key: 'facts',
        title: '앞에서 정한 사실이 바뀌어요',
        body: '8장에서 1998년에 닫힌 승강장이 26장에서는 2001년에 닫혀요. 스무 장을 건너오는 사이 숫자가 달라졌어요.',
      },
      {
        key: 'people',
        title: '인물이 조금씩 달라져요',
        body: '2장에서 열일곱이던 민아가 21장에서는 열아홉이에요. 나이와 말버릇, 관계는 한 번 흔들리면 다시 찾기 어려워요.',
      },
      {
        key: 'files',
        title: '원고 파일이 엇갈려요',
        body: '‘최종’, ‘진짜 최종’, ‘최종(2)’. 함께 쓰는 사람이 늘면 어느 파일이 지금 원고인지부터 확인해야 해요.',
      },
    ],
  },
  features: {
    title: '이야기를 이어 주는 도구들',
    lead: '작가가 쓰고, Prolog는 곁에서 원고와 기록을 살펴요.',
    items: [
      {
        key: 'manuscript',
        title: '원고',
        body: '써 둔 원고를 가져오거나 빈 페이지에서 시작해요. 쓰는 대로 저장되고, 설정 검사가 앞선 규칙과 어긋난 문장에 밑줄을 그어요.',
      },
      {
        key: 'ask',
        title: '원고에 물어보기',
        body: '“민아는 몇 살이었지?”처럼 물으면 원고 속 근거 문장과 함께 답해요.',
      },
      {
        key: 'character',
        title: '등장인물',
        body: '떠오르는 모습을 문장으로 적으면 인물 초안으로 정리해요. 무엇을 남길지는 작가가 정해요.',
      },
      {
        key: 'world',
        title: '세계관',
        body: '원고 속 세계관 규칙을 후보로 찾아 원문 근거와 함께 보여 줘요. 무엇을 규칙으로 확정할지는 작가가 정해요.',
      },
      {
        key: 'overview',
        title: '작품 살펴보기',
        body: '이야기 흐름과 인물 관계, 복선을 장 단위로 살펴요. 장을 넘기면 그 시점의 관계가 보여요.',
      },
      {
        key: 'team',
        title: '팀원 초대',
        body: '함께 쓸 사람과 읽어 줄 사람을 초대하고, 역할을 나눠요.',
      },
    ],
  },
  closing: { title: '다음 문장을 이어 써 볼까요.', body: '한 문장부터, 당신의 속도로.', tagline: '당신의 다음 문장을 위해.' },
  auth: { login: 'Prolog에 로그인하세요', signup: 'Prolog에 회원 가입하세요' },
  library: {
    description: '쓰고 있는 이야기들을 한곳에 모았어요.',
    empty: '아직 펼치지 않은 이야기가 있어요',
    next: '새 작품을 만들고 첫 문장을 적어 보세요.',
  },
} as const

export type FeatureKey = (typeof VOICE.features.items)[number]['key']
