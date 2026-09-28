// 업로드한 본문을 장으로 나눈다 — 목업 추출과 real 모드(백엔드는 본문만 추출한다)가 함께 쓴다

/** "1장", "제 2 장", "Chapter 3" 같은 줄을 기준으로 본문을 장 단위로 나눈다 */
export function splitChapters(text: string): Array<{ title: string; content: string }> {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  // 한글 '장' 뒤에서는 \b(단어 경계)가 동작하지 않으므로 공백 또는 줄 끝으로 판단한다
  const heading = /^\s*(?:제\s*)?\d+\s*장(?:\s.*)?$|^\s*chapter\s+\d+(?:\s.*)?$/i
  const out: Array<{ title: string; content: string[] }> = []
  for (const line of lines) {
    if (heading.test(line)) out.push({ title: line.trim(), content: [] })
    else {
      if (out.length === 0) out.push({ title: '1장', content: [] })
      out[out.length - 1].content.push(line)
    }
  }
  return out.map((c) => ({ title: c.title, content: c.content.join('\n').trim() })).filter((c) => c.content || out.length === 1)
}
