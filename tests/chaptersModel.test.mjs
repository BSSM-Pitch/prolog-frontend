import test from 'node:test'
import assert from 'node:assert/strict'
import { logicalSections, splitChapters } from '../src/lib/chapters.ts'

test('episode navigation retains exact offsets and ignores later planning resets', () => {
  const text = '서문\n' + Array.from({ length: 90 }, (_, i) => `${i + 1}화 제목\n본문 ${i + 1}\n`).join('') + '기획 메모\n1화 고치기\n'
  const sections = logicalSections(text)
  assert.equal(sections.length, 90)
  assert.equal(text.slice(sections[78].start, sections[78].end), '79화 제목\n본문 79\n')
  assert.match(text.slice(sections[89].start), /기획 메모/)
})
test('imports keep single chapter titles and support skipped numbers and episode headings', () => {
  assert.deepEqual(splitChapters('1장 시작\n본문'), [{ title: '시작', content: '본문' }])
  assert.deepEqual(splitChapters('1화 시작\n본문\n3화 재회\n끝'), [
    { title: '1화 시작', content: '본문' }, { title: '3화 재회', content: '끝' },
  ])
  assert.deepEqual(splitChapters('일반 원고'), [{ title: '1장', content: '일반 원고' }])
})
