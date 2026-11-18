/** Logical headings retain original offsets; importing never treats a late planning note as a new chapter. */
export function logicalSections(text: string, allowSingle = false): Array<{ title: string; start: number; end: number }> {
  const heading = /^[\t ]*(?:(?:제[\t ]*)?(\d{1,5})[\t ]*(장|화|회)|chapter[\t ]+(\d{1,5}))(?:[\t ]+[^\n]*|[.:·][^\n]*)?[\t ]*$/gim
  const accepted: RegExpMatchArray[] = []
  let previous: number | null = null
  for (const match of text.matchAll(heading)) {
    const number = Number(match[1] || match[3])
    if (previous === null || number > previous) {
      accepted.push(match)
      previous = number
    }
  }
  if (accepted.length < (allowSingle ? 1 : 2)) return []
  return accepted.map((m, i) => ({ title: m[0].trim(), start: m.index!, end: accepted[i + 1]?.index ?? text.length }))
}

export function splitChapters(text: string): Array<{ title: string; content: string }> {
  const source = text.replace(/\r\n/g, '\n')
  const sections = logicalSections(source, true)
  if (!sections.length) return [{ title: '1장', content: source.trim() }]
  const out: Array<{ title: string; content: string }> = []
  const preface = source.slice(0, sections[0].start).trim()
  if (preface) out.push({ title: '프롤로그', content: preface })
  for (const part of sections) {
    const lineEnd = source.indexOf('\n', part.start)
    const rest = part.title.replace(/^(?:제\s*)?\d+\s*(?:장|화|회)\s*[·:.-]?\s*|^chapter\s+\d+\s*[·:.-]?\s*/i, '')
    // Preserve episode numbering in its title even when storage ordinals differ.
    const title = /\d\s*(?:화|회)/.test(part.title) ? part.title : (rest || part.title)
    out.push({ title, content: lineEnd < 0 ? '' : source.slice(lineEnd + 1, part.end).trim() })
  }
  return out.filter((c) => c.content || out.length === 1)
}
