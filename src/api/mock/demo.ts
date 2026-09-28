// 시연용 작품 "붉은 문 너머"(proj_1)의 이야기 세계.
// Figma 화면(01 개요, 03 스토리 지도, 04 복선, 05 설정 충돌, 13 관계 변화, 19 편집기, 20 등장인물, 21 설정 규칙)에
// 흩어져 있는 예시를 하나로 맞춰 둔 것. 원고·인물·관계·복선이 서로 같은 장 번호를 가리킨다.

export const DEMO_PROJECT_ID = 'proj_1'

/** 27장까지 쓴 3차 원고의 장 제목과 본문 */
export const DEMO_CHAPTERS: Array<{ no: number; title: string; body: string }> = [
  { no: 1, title: '윤서의 귀향', body: '열두 해 만에 돌아온 역은 이름만 남아 있었다. 윤서는 녹슨 안내판 아래에서 가방을 내려놓고, 선로 끝에 선 붉은 문을 오래 바라보았다. 어릴 적 할머니는 그 문 앞에서는 발소리도 내지 말라고 했다.' },
  { no: 2, title: '열쇠 모양의 흉터', body: '세수를 하다가 윤서는 손목의 흉터를 다시 보았다. 열쇠 이빨처럼 들쭉날쭉한 자국이었다. 민아는 그걸 보고 웃으며, 언젠가 그 모양에 맞는 자물쇠를 찾게 될 거라고 말했었다. 그해 민아는 열일곱이었다.' },
  { no: 3, title: '비가 멎은 뒤', body: '비가 멎자 문의 윤곽이 붉게 떠올랐다. 낮에는 벽돌 틈과 구분되지 않던 선이 물기를 머금고 빛났다. 윤서는 숨을 참고 손바닥을 댔지만, 문은 여전히 차가웠다.' },
  { no: 4, title: '승강장의 남자', body: '역 승강장에서 그를 처음 보았다. 검은 우산을 접어 든 남자는 자신을 기록관 재현이라고 소개했다. 그는 윤서의 이름을 이미 알고 있었다.' },
  { no: 5, title: '민아의 실종', body: '새벽 3시 17분, 마지막 열차가 지나간 뒤 민아의 방은 비어 있었다. 창문은 안에서 잠겨 있었고, 책상 위에는 날짜가 지워진 열차표 한 장만 남아 있었다.' },
  { no: 6, title: '기록보관소', body: '기록보관소는 역사 지하에 있었다. 재현은 열람 신청서를 내밀며 위원 두 사람의 서명이 필요하다고 했다. 윤서는 서명란 옆의 빈칸을 오래 들여다보았다.' },
  { no: 7, title: '비 오는 골목', body: '골목 끝에서 누군가 윤서의 이름을 불렀다. 돌아보았을 때는 빗소리뿐이었다. 벽에 붙은 오래된 포스터에는 민아와 닮은 얼굴이 번져 있었다.' },
  { no: 8, title: '북쪽 승강장', body: '북쪽 승강장은 1998년에 폐쇄됐다고 역무일지에 적혀 있었다. 그런데 일지의 다음 장에는 1999년 겨울에도 그곳에 열차가 섰다는 기록이 남아 있었다.' },
  { no: 9, title: '위조 기록 발견', body: '재현이 건넨 서류철에서 윤서는 민아의 이름을 찾았다. 실종 신고서의 필체는 두 가지였다. 열쇠는 기록위원회가 보관한다는 문장 위에 누군가 덧칠한 흔적이 있었다. 재현은 자기 학창 시절에 대해서는 한마디도 하지 않았다.' },
  { no: 10, title: '서담의 편지', body: '서담은 편지 끝에 붉은 잉크로 선을 그었다. 문을 열려는 사람은 먼저 기록되어야 한다고 적혀 있었다.' },
  { no: 11, title: '겨울의 기억', body: '윤서는 붉은 빛 아래에서 본 기억이 하루 뒤 흐려진다는 것을 알게 되었다. 어제 적어 둔 메모가 낯선 사람의 글씨처럼 보였다.' },
  { no: 12, title: '비밀 열쇠 전달', body: '"이건 당신에게 맡길게요." 윤서는 보관소의 비밀 열쇠를 재현에게 건넸다. 재현은 한참 망설이다가 열쇠를 코트 안쪽 주머니에 넣었다. 그날 밤 재현은 열쇠에 대해 아무에게도 말하지 않기로 했다.' },
  { no: 13, title: '도하', body: '도하는 위원회의 막내였다. 그는 윤서에게 규칙을 어긴 사람들의 명단을 보여 주었지만, 마지막 장은 찢겨 있었다.' },
  { no: 14, title: '흉터가 아프다', body: '문 앞에 설 때마다 손목의 흉터가 욱신거렸다. 윤서는 흉터의 모양이 문 손잡이 아래 홈과 같다는 것을 알아차렸다.' },
  { no: 15, title: '위원회의 소집', body: '기록위원회가 5년 만에 소집되었다. 회의록 첫 줄에는 윤서의 이름이 적혀 있었다.' },
  { no: 16, title: '민아의 목소리', body: '녹음기에서 흘러나온 목소리는 분명 민아였다. 테이프에 적힌 날짜는 민아가 사라진 다음 날이었다.' },
  { no: 17, title: '규칙 17 공개', body: '도하는 위원회 규약의 열일곱 번째 조항을 소리 내어 읽었다. 붉은 문을 연 사람은 그 순간부터 기록에서 지워진다. 윤서는 처음으로 이 규칙을 알았다.' },
  { no: 18, title: '재현의 회상', body: '재현은 학교를 다닌 기억이 없다고 했다. 졸업 사진에도, 출석부에도 그의 이름은 없었다. 그는 그 빈자리가 자기가 여기 있는 이유라고 말했다.' },
  { no: 19, title: '매년 겨울', body: '"기록보관소가 닫히기 전까지 우리는 매년 겨울 만났다." 재현은 그렇게 말하며 오래된 사진을 내밀었다. 사진 속 두 사람은 지금보다 훨씬 어렸다.' },
  { no: 20, title: '지하 기록실', body: '지하 기록실에는 금속을 가지고 들어갈 수 없었다. 윤서는 반지를 빼 문 앞에 두고 계단을 내려갔다.' },
  { no: 21, title: '민아의 나이', body: '실종 당시 민아는 열아홉이었다고 서류에 적혀 있었다. 윤서는 그 숫자에 동그라미를 쳤다.' },
  { no: 22, title: '기록위원회 진입', body: '윤서는 규칙 17을 알면서도 위원회 문을 열었다. 재현이 건넨 열쇠는 아직 차가웠다. "규칙 17을 알면서 여기까지 왔어?" 재현의 목소리에는 처음 듣는 날이 서 있었다.' },
  { no: 23, title: '위원회 붕괴', body: '위조 기록이 공개되자 위원회는 하룻밤 사이에 흩어졌다. 도하만이 남아 문서를 태우지 않고 상자에 담았다.' },
  { no: 24, title: '두 번째 원장', body: '상자 맨 아래에서 두 번째 기록 원장이 나왔다. 첫 번째 원장과 같은 날짜, 다른 이름들이 적혀 있었다.' },
  { no: 25, title: '붉은 문 앞의 다툼', body: '재현은 문을 열지 말라고 했다. 윤서는 민아가 그 너머에 있다고 믿었다. 두 사람은 처음으로 서로에게 목소리를 높였다.' },
  { no: 26, title: '폐쇄 연도', body: '역무원은 북쪽 승강장이 2001년에 문을 닫았다고 기억했다. 일지의 숫자와는 또 달랐다.' },
  { no: 27, title: '붉은 문 개방', body: '비가 그친 뒤에도 골목에는 붉은 빛이 남아 있었다. 윤서는 봉투를 접어 주머니에 넣고 문 앞에 섰다. 그 문은 어제보다 가까워 보였다. 손잡이에 닿기 직전, 재현이 맡겨 둔 열쇠의 무게가 다시 떠올랐다.' },
]

export interface DemoCharacter {
  character_id: string
  name: string
  role_label: string
  status_label: string
  last_chapter: number
  personality_tags: string[]
  core_values: string[]
  influence_relations: Array<{ target: string; type: string; status: string | null }>
  emotion_keywords: string[]
}

export const DEMO_CHARACTERS: DemoCharacter[] = [
  { character_id: 'char_001', name: '윤서', role_label: '주인공', status_label: '활동 중', last_chapter: 27, personality_tags: ['신중함', '집요함'], core_values: ['약속 중시'], influence_relations: [{ target: '재현', type: '영향', status: null }], emotion_keywords: ['불안'] },
  { character_id: 'char_002', name: '재현', role_label: '조력자', status_label: '활동 중', last_chapter: 27, personality_tags: ['과묵함', '보호 본능'], core_values: ['기록의 보존'], influence_relations: [{ target: '기록위원회', type: '소속', status: null }], emotion_keywords: ['죄책감'] },
  { character_id: 'char_003', name: '민아', role_label: '실종자', status_label: '실종', last_chapter: 16, personality_tags: ['쾌활함', '호기심'], core_values: ['자유'], influence_relations: [{ target: '윤서', type: '가족', status: null }], emotion_keywords: ['그리움'] },
  { character_id: 'char_004', name: '도하', role_label: '기록관', status_label: '상태 미확인', last_chapter: 23, personality_tags: ['원칙주의'], core_values: ['규칙 준수'], influence_relations: [{ target: '기록위원회', type: '소속', status: null }], emotion_keywords: ['망설임'] },
  { character_id: 'char_005', name: '서담', role_label: '대립 인물', status_label: '활동 중', last_chapter: 10, personality_tags: ['냉정함'], core_values: ['비밀 유지'], influence_relations: [], emotion_keywords: ['경계'] },
  { character_id: 'char_006', name: '기록위원회', role_label: '단체', status_label: '해체', last_chapter: 23, personality_tags: [], core_values: ['기록 독점'], influence_relations: [], emotion_keywords: [] },
]

export interface DemoRelationship {
  relationship_id: string
  source: string
  target: string
  history: Array<{ chapter: number; state: string; trust: number; event: string | null; event_deleted?: boolean }>
}

export const DEMO_RELATIONSHIPS: DemoRelationship[] = [
  {
    relationship_id: 'rel_001',
    source: 'char_001',
    target: 'char_002',
    history: [
      { chapter: 4, state: '긴장', trust: 20, event: '승강장에서의 첫 만남' },
      { chapter: 12, state: '신뢰', trust: 38, event: '비밀 열쇠 전달' },
      { chapter: 19, state: '신뢰', trust: 56, event: '매년 겨울의 사진', event_deleted: true },
      { chapter: 25, state: '갈등', trust: 30, event: '붉은 문 앞의 다툼' },
    ],
  },
  {
    relationship_id: 'rel_002',
    source: 'char_001',
    target: 'char_003',
    history: [
      { chapter: 2, state: '우호', trust: 70, event: '흉터 이야기' },
      { chapter: 5, state: '중립', trust: 15, event: '민아의 실종' },
    ],
  },
  {
    relationship_id: 'rel_003',
    source: 'char_001',
    target: 'char_006',
    history: [
      { chapter: 15, state: '긴장', trust: 40, event: '위원회의 소집' },
      { chapter: 22, state: '갈등', trust: 27, event: '기록위원회 진입' },
    ],
  },
  {
    relationship_id: 'rel_004',
    source: 'char_002',
    target: 'char_004',
    history: [{ chapter: 13, state: '우호', trust: 50, event: null }],
  },
]

export interface DemoConflict {
  conflict_id: string
  title: string
  /** 규칙 위반으로 감지된 충돌이면 규칙 ID */
  rule_id?: string | null
  modified_content?: string | null
  resolved_at?: string | null
  severity: 'high' | 'medium' | 'low'
  status: 'pending' | 'accepted' | 'ignored' | 'modified'
  evidence: Array<{ chapter: number; character: string | null; quote: string }>
  advice: string
}

export const DEMO_CONFLICTS: DemoConflict[] = [
  {
    conflict_id: 'conf_01',
    title: '윤서와 재현이 처음 만난 시점',
    severity: 'high',
    status: 'pending',
    evidence: [
      { chapter: 4, character: '윤서', quote: '역 승강장에서 그를 처음 보았다.' },
      { chapter: 19, character: '재현', quote: '기록보관소가 닫히기 전까지 우리는 매년 겨울 만났다.' },
    ],
    advice: "19장의 '매년 겨울 만났다'는 4장에서 처음 만났다는 설정과 맞지 않아요. 19장 문장을 '그해 겨울부터 우리는 매년 만났다'처럼 고치는 것을 고려해 보세요.",
  },
  {
    conflict_id: 'conf_02',
    title: '북쪽 승강장 폐쇄 연도',
    severity: 'medium',
    status: 'pending',
    evidence: [
      { chapter: 8, character: null, quote: '북쪽 승강장은 1998년에 폐쇄됐다고 역무일지에 적혀 있었다.' },
      { chapter: 26, character: null, quote: '역무원은 북쪽 승강장이 2001년에 문을 닫았다고 기억했다.' },
    ],
    advice: '8장과 26장의 폐쇄 연도가 달라요. 기억 착오를 의도한 것이 아니라면 한쪽으로 맞추거나, 26장에 역무원이 잘못 기억한다는 단서를 넣어 보세요.',
  },
  {
    conflict_id: 'conf_03',
    title: '민아의 나이',
    severity: 'low',
    status: 'pending',
    evidence: [
      { chapter: 2, character: '민아', quote: '그해 민아는 열일곱이었다.' },
      { chapter: 21, character: '민아', quote: '실종 당시 민아는 열아홉이었다고 서류에 적혀 있었다.' },
    ],
    advice: '2장과 5장 사이의 시간이 2년 이상이 아니라면 나이가 맞지 않아요. 서류가 위조되었다는 설정이라면 21장에 그 의도를 드러내 보세요.',
  },
]

export interface DemoForeshadowing {
  foreshadowing_id: string
  code: string
  title: string
  description: string
  setup_chapter: number
  linked_chapters: number[]
  payoff_chapter: number | null
  characters: string[]
  events: string[]
}

export const DEMO_FORESHADOWINGS: DemoForeshadowing[] = [
  { foreshadowing_id: 'fs_001', code: 'F01', title: '붉은 열쇠 모양의 흉터', description: '윤서와 봉인된 기록보관소를 연결하는 반복 단서', setup_chapter: 2, linked_chapters: [14], payoff_chapter: null, characters: ['윤서'], events: ['열쇠 모양의 흉터'] },
  { foreshadowing_id: 'fs_002', code: 'F02', title: '새벽 3시 17분 열차', description: '민아가 사라진 이동 경로를 드러내는 반복 시각', setup_chapter: 5, linked_chapters: [16], payoff_chapter: 22, characters: ['민아'], events: ['민아의 실종'] },
  { foreshadowing_id: 'fs_003', code: 'F03', title: '재현의 비어 있는 학창 시절', description: '회수 장면이 아직 배정되지 않은 단서', setup_chapter: 9, linked_chapters: [18], payoff_chapter: null, characters: ['윤서', '재현'], events: ['사라진 기록'] },
  { foreshadowing_id: 'fs_004', code: 'F04', title: '두 번째 기록 원장', description: '기록위원회의 주장을 뒤집는 새로운 증거', setup_chapter: 9, linked_chapters: [23], payoff_chapter: 24, characters: ['도하'], events: ['위원회 붕괴'] },
  { foreshadowing_id: 'fs_005', code: 'F05', title: '서담의 붉은 잉크', description: '문을 열려면 먼저 기록되어야 한다는 경고', setup_chapter: 10, linked_chapters: [], payoff_chapter: 17, characters: ['서담'], events: ['규칙 17 공개'] },
]

export interface DemoStoryNode {
  node_id: string
  chapter: number
  title: string
  type: 'event' | 'turning_point' | 'climax'
  summary: string
  characters: string[]
}

export const DEMO_STORY: {
  acts: Array<{ act_name: string; chapter_from: number; chapter_to: number; summary: string }>
  nodes: DemoStoryNode[]
  edges: Array<{ from: string; to: string; relation: 'causes' | 'affects' }>
} = {
  acts: [
    { act_name: '발단', chapter_from: 1, chapter_to: 5, summary: '윤서가 폐역으로 돌아오고 민아가 사라진다' },
    { act_name: '전개', chapter_from: 6, chapter_to: 14, summary: '기록보관소와 위조 기록, 비밀 열쇠' },
    { act_name: '위기', chapter_from: 15, chapter_to: 22, summary: '규칙 17이 드러나고 윤서는 위원회로 들어간다' },
    { act_name: '절정', chapter_from: 23, chapter_to: 27, summary: '위원회가 무너지고 붉은 문이 열린다' },
  ],
  nodes: [
    { node_id: 'node_01', chapter: 1, title: '윤서의 귀향', type: 'event', summary: '열두 해 만에 폐역으로 돌아온다', characters: ['윤서'] },
    { node_id: 'node_05', chapter: 5, title: '민아의 실종', type: 'turning_point', summary: '새벽 3시 17분 이후 민아가 사라진다', characters: ['민아', '윤서'] },
    { node_id: 'node_09', chapter: 9, title: '위조 기록 발견', type: 'event', summary: '실종 신고서의 필체가 두 가지임을 알게 된다', characters: ['윤서', '재현'] },
    { node_id: 'node_12', chapter: 12, title: '비밀 열쇠 전달', type: 'turning_point', summary: '윤서가 재현에게 보관소의 비밀 열쇠를 맡긴다', characters: ['윤서', '재현'] },
    { node_id: 'node_17', chapter: 17, title: '규칙 17 공개', type: 'event', summary: '문을 연 사람은 기록에서 지워진다는 조항이 드러난다', characters: ['도하', '윤서'] },
    { node_id: 'node_23', chapter: 23, title: '위원회 붕괴', type: 'climax', summary: '위조 기록이 공개되고 위원회가 흩어진다', characters: ['도하'] },
    { node_id: 'node_27', chapter: 27, title: '붉은 문 개방', type: 'climax', summary: '윤서가 붉은 문 앞에 선다', characters: ['윤서', '재현'] },
  ],
  edges: [
    { from: 'node_05', to: 'node_09', relation: 'causes' },
    { from: 'node_09', to: 'node_12', relation: 'causes' },
    { from: 'node_12', to: 'node_17', relation: 'affects' },
    { from: 'node_17', to: 'node_23', relation: 'causes' },
    { from: 'node_23', to: 'node_27', relation: 'causes' },
  ],
}

export interface DemoRule {
  rule_id: string
  code: string
  title: string
  description: string
  violation_keywords: string[]
  origin: 'ai_extracted' | 'user_added'
  status: 'confirmed' | 'pending' | 'ignored'
  source_chapter: number | null
  evidence: string | null
}

export const DEMO_RULES: DemoRule[] = [
  { rule_id: 'wr_01', code: 'R01', title: '붉은 빛과 기억', description: '붉은 빛 아래 노출된 기억은 하루 뒤 흐려진다', violation_keywords: ['기억이 선명', '다음 날에도 기억'], origin: 'ai_extracted', status: 'confirmed', source_chapter: 11, evidence: '윤서는 붉은 빛 아래에서 본 기억이 하루 뒤 흐려진다는 것을 알게 되었다.' },
  { rule_id: 'wr_02', code: 'R02', title: '지하 기록실', description: '지하 기록실에는 금속을 반입할 수 없다', violation_keywords: ['금속을 들고', '열쇠를 가지고 기록실'], origin: 'ai_extracted', status: 'confirmed', source_chapter: 20, evidence: '지하 기록실에는 금속을 가지고 들어갈 수 없었다.' },
  { rule_id: 'wr_03', code: 'R03', title: '규칙 17', description: '붉은 문을 연 사람은 그 순간부터 기록에서 지워진다', violation_keywords: ['문을 연 뒤에도 기록'], origin: 'ai_extracted', status: 'confirmed', source_chapter: 17, evidence: '붉은 문을 연 사람은 그 순간부터 기록에서 지워진다.' },
  { rule_id: 'wr_11', code: 'R11', title: '붉은 문', description: '붉은 문은 비가 그친 뒤에만 열린다', violation_keywords: ['비 오는 중에 열림', '맑은 날 개방', '문이 저절로 열림'], origin: 'ai_extracted', status: 'pending', source_chapter: 3, evidence: '비가 멎자 문의 윤곽이 붉게 떠올랐다.' },
  { rule_id: 'wr_12', code: 'R12', title: '기록 열람', description: '기록 열람에는 위원 2인의 승인이 필요하다', violation_keywords: ['혼자 열람', '승인 없이'], origin: 'ai_extracted', status: 'pending', source_chapter: 6, evidence: '위원 두 사람의 서명이 필요하다고 했다.' },
]
