import type { MockChapter } from './db'

// 목업 "AI". 실제 모델 대신 질문의 낱말로 원고를 찾아 근거 장면을 붙여 답한다.

export interface Citation {
  chapter_no: number
  chapter_title: string | null
  quote: string
}

const PARTICLES = /(으로|에서|에게|까지|부터|이랑|하고|은|는|이|가|을|를|에|의|도|와|과|로|만|요|나요|까요)$/
const STOPWORDS = new Set(['그리고', '어떻게', '무엇', '어디', '언제', '정말', '이미', '알고', '있나요', '있어', '어떤', '이유', '장면', '원고', '이야기'])

function keywords(question: string): string[] {
  return question
    .split(/[^0-9A-Za-z가-힣]+/)
    .map((w) => w.replace(PARTICLES, ''))
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。”"])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function bestSentence(text: string, words: string[]): string {
  const list = sentences(text)
  let best = list[0] ?? text
  let score = -1
  for (const s of list) {
    const sc = words.reduce((n, w) => n + (s.includes(w) ? 1 : 0), 0)
    if (sc > score) {
      best = s
      score = sc
    }
  }
  return best.length > 80 ? `${best.slice(0, 78)}…` : best
}

export function answerQuestion(question: string, chapters: MockChapter[], selection: string | null): { content: string; citations: Citation[] } {
  const words = keywords(`${question} ${selection ?? ''}`)
  const mentioned = [...question.matchAll(/(\d+)\s*장/g)].map((m) => Number(m[1]))

  const scored = chapters
    .map((c) => ({
      c,
      score: words.reduce((n, w) => n + (c.content.split(w).length - 1) + (c.title?.includes(w) ? 2 : 0), 0) + (mentioned.includes(c.chapter_no) ? 5 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.chapter_no - b.c.chapter_no)
    .slice(0, 2)
    .sort((a, b) => a.c.chapter_no - b.c.chapter_no)

  if (scored.length === 0) {
    return {
      content: '원고에서 질문과 직접 관련된 문장을 찾지 못했어요. 인물 이름이나 장 번호를 넣어 다시 물어봐 주세요.',
      citations: [],
    }
  }

  const citations: Citation[] = scored.map(({ c }) => ({ chapter_no: c.chapter_no, chapter_title: c.title, quote: bestSentence(c.content, words) }))

  // Figma 02 예시 질문은 화면과 같은 답을 돌려준다
  if (/규칙\s*17/.test(question) && citations.length === 2) {
    const [a, b] = citations
    return {
      content: `윤서는 ${a.chapter_no}장에서 규칙 17을 처음 확인합니다. ${b.chapter_no}장에서는 이미 알고 행동하는 것으로 읽힙니다.`,
      citations,
    }
  }

  const prefix = selection ? `선택한 문장 “${selection.length > 40 ? `${selection.slice(0, 38)}…` : selection}”과 이어지는 장면을 찾았어요. ` : ''
  const body =
    citations.length === 1
      ? `${citations[0].chapter_no}장에 관련된 내용이 있어요. “${citations[0].quote}”`
      : `${citations[0].chapter_no}장과 ${citations[1].chapter_no}장에서 관련 내용을 찾았어요. ${citations[0].chapter_no}장에서는 “${citations[0].quote}”라고 나오고, ${citations[1].chapter_no}장에서는 “${citations[1].quote}”라고 나와요. 두 장면이 자연스럽게 이어지는지 원문에서 확인해 보세요.`
  return { content: prefix + body, citations }
}

// ───────── 자연어 인물 추출 (NLCD) ─────────

export interface Extracted {
  value: string
  evidence: string
  type?: string
}

const TRAITS: Array<[RegExp, string]> = [
  [/신중/, '신중함'],
  [/집요/, '집요함'],
  [/책임감/, '책임감 강함'],
  [/자신감이?\s*(부족|없)/, '자신감 부족'],
  [/용감|용기/, '용감함'],
  [/냉정|차갑/, '냉정함'],
  [/다정|따뜻/, '다정함'],
  [/호기심/, '호기심 많음'],
  [/소심/, '소심함'],
  [/과묵|말이 없/, '과묵함'],
  [/충동/, '충동적'],
  [/성실/, '성실함'],
  [/차분/, '차분함'],
  [/예민/, '예민함'],
  [/고집/, '고집이 셈'],
  [/겁이 많|겁쟁이/, '겁이 많음'],
  [/똑똑|영리/, '영리함'],
  [/밝고|밝은|쾌활/, '쾌활함'],
]

const VALUES: Array<[RegExp, string]> = [
  [/약속/, '약속 중시'],
  [/폭력을?\s*(싫어|피|거부)/, '폭력 회피'],
  [/책임을?\s*(다|중요)/, '책임 중시'],
  [/정의/, '정의'],
  [/가족/, '가족 중시'],
  [/자유/, '자유'],
  [/정직|솔직|거짓말을?\s*(싫어|하지 않)/, '정직'],
  [/진실/, '진실 추구'],
  [/복수/, '복수'],
  [/명예/, '명예'],
  [/기록/, '기록의 보존'],
]

const EMOTIONS: Array<[RegExp, string]> = [
  [/불안/, '불안'],
  [/두려|무서/, '두려움'],
  [/분노|화가|화를/, '분노'],
  [/슬픔|슬퍼/, '슬픔'],
  [/외로/, '외로움'],
  [/설렘|설레/, '설렘'],
  [/죄책감|미안/, '죄책감'],
  [/그리움|그리워/, '그리움'],
  [/질투/, '질투'],
  [/기쁨|기뻐/, '기쁨'],
]

/** 키워드가 들어 있는 짧은 구절을 근거로 돌려준다 */
function clauseAround(text: string, index: number, length: number): string {
  const clauses = text.split(/(?<=[,.!?])\s*|(?<=며)\s+|(?<=고,)\s*/)
  let pos = 0
  for (const c of clauses) {
    const start = text.indexOf(c, pos)
    if (start <= index && index < start + c.length) {
      const trimmed = c.replace(/[,.!?]$/, '').trim()
      if (trimmed.length <= 18) return trimmed
      // 길면 키워드 앞뒤만 남긴다
      const local = index - start
      const from = Math.max(0, local - 4)
      return trimmed.slice(from, Math.min(trimmed.length, local + length + 10)).trim()
    }
    pos = start + c.length
  }
  return text.slice(Math.max(0, index - 4), index + length + 8).trim()
}

function scan(text: string, rules: Array<[RegExp, string]>): Extracted[] {
  const out: Extracted[] = []
  for (const [re, value] of rules) {
    const m = re.exec(text)
    if (m && !out.some((o) => o.value === value)) out.push({ value, evidence: clauseAround(text, m.index, m[0].length) })
  }
  return out
}

export type ReturnTypeExtract = ReturnType<typeof extractCharacter>

export function extractCharacter(text: string): {
  personality_tags: Extracted[]
  core_values: Extracted[]
  influence_relations: Extracted[]
  emotion_keywords: Extracted[]
} {
  const influence: Extracted[] = []
  const re = /([가-힣A-Za-z]{1,6}?)(?:의|에게서|에게|한테서|한테)\s*(?:[가-힣]+\s*)?(?:영향|가르침|은혜|배신)/g
  for (const m of text.matchAll(re)) {
    const target = m[1]
    if (!influence.some((i) => i.value === target)) influence.push({ value: target, type: /배신/.test(m[0]) ? '배신' : '영향', evidence: clauseAround(text, m.index ?? 0, m[0].length) })
  }
  return {
    personality_tags: scan(text, TRAITS),
    core_values: scan(text, VALUES),
    influence_relations: influence,
    emotion_keywords: scan(text, EMOTIONS),
  }
}
