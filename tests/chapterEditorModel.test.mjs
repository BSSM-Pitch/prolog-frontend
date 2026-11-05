import test from 'node:test'
import assert from 'node:assert/strict'
import { ChapterSaveQueue, selectedChapter, withCreatedChapters } from '../src/features/manuscripts/chapterEditorModel.ts'

const first = { chapter_id: 'a', chapter_no: 1, content: '첫 장 본문' }
const second = { chapter_id: 'b', chapter_no: 2, content: '' }
test('missing or not-yet-loaded chapter never displays another chapter body', () => {
  assert.equal(selectedChapter([first], '2'), null)
  assert.equal(selectedChapter([first], 'invalid'), null)
  assert.equal(selectedChapter([first, second], '2'), second)
  assert.equal(selectedChapter([first, second], '1'), first)
  assert.equal(selectedChapter([first], null), first)
})
test('editing another chapter while a save waits preserves both target IDs and latest text', async () => {
  const queue = new ChapterSaveQueue()
  queue.enqueue('a', '첫 장 수정')
  let release
  const waiting = new Promise((resolve) => { release = resolve })
  const sent = []
  const save = async (job) => { sent.push(job); if (sent.length === 1) await waiting }
  const draining = queue.flush(save)
  queue.enqueue('b', '둘째 장 수정')
  queue.enqueue('a', '첫 장 최신 수정')
  const duplicateFlush = queue.flush(save)
  release()
  assert.equal(await draining, true)
  assert.equal(await duplicateFlush, true)
  assert.deepEqual(sent, [
    { chapterId: 'a', content: '첫 장 수정' },
    { chapterId: 'b', content: '둘째 장 수정' },
    { chapterId: 'a', content: '첫 장 최신 수정' },
  ])
  assert.equal(queue.dirty, false)
})
test('failed save retains newer draft and retries it instead of overwriting it with stale text', async () => {
  const queue = new ChapterSaveQueue()
  queue.enqueue('a', 'old')
  assert.equal(await queue.flush(async () => { queue.enqueue('a', 'new'); throw Error('offline') }), false)
  assert.equal(queue.dirty, true)
  const retried = []
  assert.equal(await queue.flush(async (job) => { retried.push(job) }), true)
  assert.deepEqual(retried, [{ chapterId: 'a', content: 'new' }])
})

test('a late chapter-list response cannot replace the newly added target with old body text', () => {
  const lateList = [first]
  const merged = withCreatedChapters(lateList, { b: second })
  assert.equal(selectedChapter(merged, '2'), second)
  assert.equal(selectedChapter(merged, '2').content, '')
  const latest = { ...second, content: 'server saved second chapter' }
  assert.equal(selectedChapter(withCreatedChapters([first, latest], { b: second }), '2'), latest)
})
