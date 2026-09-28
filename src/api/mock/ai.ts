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
