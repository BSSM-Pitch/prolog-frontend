export const MAX_RULE_EXTRACTION_CHARS = 30_000

// Match Python len(): count Unicode code points, including whitespace and line breaks.
export const countRuleChars = (text: string) => Array.from(text).length

export function ruleExtractionSelection<T extends { chapter_id: string; chapter_no: number; content: string }>(chapters: T[], ids: string[]) {
  const selectedIds = new Set(ids)
  const selected = chapters.filter((c) => selectedIds.has(c.chapter_id)).sort((a, b) => a.chapter_no - b.chapter_no)
  const text = selected.map((c) => c.content).join('\n\n')
  const charCount = countRuleChars(text)
  const error = !selected.length ? '분석할 장을 선택해 주세요.'
    : !text.trim() ? '선택한 장에 분석할 본문이 없어요.'
      : charCount > MAX_RULE_EXTRACTION_CHARS ? '한 번에 30,000자까지 분석할 수 있어요. 분석할 장을 줄여 주세요.' : null
  return { selected, text, charCount, error }
}
