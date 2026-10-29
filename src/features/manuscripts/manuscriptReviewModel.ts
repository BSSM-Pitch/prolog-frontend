import type { Conflict } from '../../api/types'

export interface ManuscriptIssue {
  start: number
  end: number
  conflicts: Conflict[]
}

// 공백만 정규화한다. 원문의 UTF-16 위치를 보존해 textarea 선택 범위와 맞춘다.
function normalized(text: string) {
  let value = ''
  const starts: number[] = []
  const ends: number[] = []
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) {
      if (!value || value.endsWith(' ')) continue
      value += ' '
    } else value += text[i]
    starts.push(i)
    ends.push(i + 1)
  }
  if (value.endsWith(' ')) {
    value = value.slice(0, -1)
    starts.pop()
    ends.pop()
  }
  return { value, starts, ends }
}

function uniqueIndex(text: string, quote: string) {
  if (!quote) return -1
  const at = text.indexOf(quote)
  return at >= 0 && text.indexOf(quote, at + 1) < 0 ? at : -1
}

export function evidenceRange(text: string, quote: string, context?: string) {
  const source = normalized(text)
  const needle = normalized(quote).value
  let at = uniqueIndex(source.value, needle)
  // 반복된 문장은 실제 검사한 문맥으로 한 곳을 특정할 수 있을 때만 표시한다.
  if (at < 0 && context) {
    const surrounding = normalized(context).value
    const contextAt = uniqueIndex(source.value, surrounding)
    const quoteAt = uniqueIndex(surrounding, needle)
    if (contextAt >= 0 && quoteAt >= 0) at = contextAt + quoteAt
  }
  if (at < 0) return null
  return { start: source.starts[at], end: source.ends[at + needle.length - 1] }
}

export function manuscriptIssues(text: string, chapterId: string, conflicts: Conflict[]): ManuscriptIssue[] {
  const located = conflicts
    .flatMap((conflict) => {
      const anchor = conflict.anchor
      if (conflict.status !== 'pending' || !anchor || anchor.chapter_id !== chapterId) return []
      const range = evidenceRange(text, anchor.quote, anchor.context)
      return range ? [{ ...range, conflicts: [conflict] }] : []
    })
    .sort((a, b) => a.start - b.start || b.end - a.end)
  const groups: ManuscriptIssue[] = []
  for (const next of located) {
    const previous = groups.at(-1)
    if (previous && next.start < previous.end) {
      previous.end = Math.max(previous.end, next.end)
      previous.conflicts.push(...next.conflicts)
    } else groups.push(next)
  }
  return groups
}
