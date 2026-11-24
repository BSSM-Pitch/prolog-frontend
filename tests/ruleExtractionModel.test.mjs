import test from 'node:test'
import assert from 'node:assert/strict'
import { countRuleChars, ruleExtractionSelection } from '../src/features/world/ruleExtractionModel.ts'
const chapter = (id, no, content) => ({ chapter_id: id, chapter_no: no, content })

test('counts Hangul, emoji, spaces and newlines consistently with the server', () => {
  assert.equal(countRuleChars('한😀 \n글'), 5)
  for (const length of [29999, 30000, 30001]) {
    const result = ruleExtractionSelection([chapter('a', 1, '가'.repeat(length))], ['a'])
    assert.equal(result.charCount, length)
    assert.equal(result.error === null, length <= 30000)
  }
})
test('only selected chapters are included, in manuscript order, with counted separators', () => {
  const chapters = [chapter('c', 9, '끝'), chapter('b', 4, '비밀'), chapter('a', 2, '앞')]
  const result = ruleExtractionSelection(chapters, ['c', 'a'])
  assert.equal(result.text, '앞\n\n끝')
  assert.equal(result.charCount, 4)
  assert.deepEqual(result.selected.map((c) => c.chapter_no), [2, 9])
  assert.equal(result.error, null)
})
test('multi-chapter boundary includes separators; empty selection and whitespace cannot run', () => {
  const chapters = [chapter('a', 1, '가'.repeat(15000)), chapter('b', 2, '나'.repeat(14998))]
  assert.equal(ruleExtractionSelection(chapters, ['a', 'b']).error, null)
  chapters[1].content += '다'
  assert.match(ruleExtractionSelection(chapters, ['a', 'b']).error, /30,000/)
  assert.ok(ruleExtractionSelection(chapters, []).error)
  assert.ok(ruleExtractionSelection([chapter('a', 1, '  \n ')], ['a']).error)
})
