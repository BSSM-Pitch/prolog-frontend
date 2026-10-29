import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evidenceRange, manuscriptIssues } from '../src/features/manuscripts/manuscriptReviewModel.ts'

const conflict = (id, chapterId, quote, extra = {}) => ({
  conflict_id: id,
  status: 'pending',
  anchor: { chapter_id: chapterId, quote },
  ...extra,
})

test('whitespace normalization preserves Korean and UTF-16 textarea offsets', () => {
  const text = '🌙 앞 문장.\n\n윤서는\t\t문을 열었다.\n다음 문장.'
  const range = evidenceRange(text, '윤서는 문을 열었다.')
  assert.deepEqual(range, { start: text.indexOf('윤서'), end: text.indexOf('\n다음') })
  assert.equal(text.slice(range.start, range.end), '윤서는\t\t문을 열었다.')
})

test('editing a quote removes the stale underline; editing before it moves its position', () => {
  const original = '윤서는 문을 열었다.'
  const records = [conflict('c1', 'ch1', original)]
  assert.equal(manuscriptIssues('그날, ' + original, 'ch1', records)[0].start, 4)
  assert.equal(manuscriptIssues('윤서는 문을 닫았다.', 'ch1', records).length, 0)
})

test('same chapter number in another manuscript and unlocated evidence are never annotated', () => {
  const quote = '문이 열렸다.'
  const records = [
    conflict('other', 'another-manuscript-ch1', quote),
    { conflict_id: 'legacy', status: 'pending', evidence: [{ chapter: 1, quote }] },
  ]
  assert.deepEqual(manuscriptIssues(quote, 'current-manuscript-ch1', records), [])
})

test('ambiguous repeated quotes require a unique matching context', () => {
  const text = '첫날. 문이 열렸다.\n마지막 날. 문이 열렸다.'
  assert.equal(evidenceRange(text, '문이 열렸다.'), null)
  const range = evidenceRange(text, '문이 열렸다.', '마지막 날. 문이 열렸다.')
  assert.equal(range.start, text.lastIndexOf('문이 열렸다.'))
  assert.equal(evidenceRange(text, '문이 열렸다.', '없어진 문맥. 문이 열렸다.'), null)
  assert.equal(evidenceRange(text, ''), null)
})

test('overlapping reports form one underline without losing individual explanations', () => {
  const records = [
    conflict('c1', 'ch1', '문이 열렸다.'),
    conflict('c2', 'ch1', '열렸다.'),
    conflict('c3', 'ch1', '닫혔다.'),
  ]
  const text = '문이 열렸다. 닫혔다.'
  const issues = manuscriptIssues(text, 'ch1', records)
  assert.equal(issues.length, 2)
  assert.deepEqual(
    issues[0].conflicts.map((c) => c.conflict_id),
    ['c1', 'c2'],
  )
  assert.equal(text.slice(issues[0].start, issues[0].end), '문이 열렸다.')
})

test('resolved, ignored and accepted results disappear without altering source text', () => {
  const text = '문이 열렸다.'
  const records = ['accepted', 'ignored', 'modified'].map((status) =>
    conflict(status, 'ch1', text, { status }),
  )
  assert.deepEqual(manuscriptIssues(text, 'ch1', records), [])
  assert.equal(text, '문이 열렸다.')
})
