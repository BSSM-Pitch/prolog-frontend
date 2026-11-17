import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterTracks, pageItems } from '../src/features/world/narrativeBrowseModel.ts'
import { markdownBody } from '../src/components/richTextModel.ts'
const items = Array.from({ length: 80 }, (_, index) => ({ title: `항목 ${index}`, kind: index % 2 ? 'relationship' : 'foreshadowing', focus: 'knowledge', status: index % 3 ? 'unresolved' : 'paid_off', explanation: '사건의 선후 관계', evidence: [{ chapter_no: index + 1, quote: index === 79 ? '아린의 비밀' : '원문' }] }))
const empty = { query: '', kind: '', focus: '', status: '', chapter: '' }
test('80 tracks remain discoverable by late source text, filters retain original adoption index', () => {
  const rows = filterTracks(items, { ...empty, query: ' 아린 ', kind: 'relationship', chapter: '80', focus: 'knowledge' })
  assert.deepEqual(rows.map((row) => row.index), [79])
  assert.equal(filterTracks(items, { ...empty, query: '없는 인물' }).length, 0)
  const pages = pageItems(filterTracks(items, empty), 10)
  assert.equal(pages.items.at(-1).index, 79)
  assert.equal(pageItems(rows, 10).page, 1)
  assert.equal(pageItems([], NaN).pages, 1)
})
test('Markdown wrappers unwrap only an explicit whole-document markdown fence', () => {
  assert.equal(markdownBody('```markdown\r\n## 제목\r\n**강조**\r\n```'), '## 제목\n**강조**')
  assert.equal(markdownBody('```js\nconst x = 1\n```'), '```js\nconst x = 1\n```')
  assert.equal(markdownBody('앞\n```md\n내용\n```'), '앞\n```md\n내용\n```')
  assert.equal(markdownBody('문자열 \\n 유지'), '문자열 \\n 유지')
})
