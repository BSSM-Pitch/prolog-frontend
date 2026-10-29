import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendManuscriptFiles, MAX_MANUSCRIPT_BYTES, runManuscriptUploads, validateManuscriptFile } from '../src/features/manuscripts/manuscriptUploadModel.ts'

const file = (name, content = '원고 본문', lastModified = 1) => new File([content], name, { lastModified })
const queue = (...files) => appendManuscriptFiles([], files).items

test('successive selections append in order and deduplicate the same file, not different revisions', () => {
  const a = file('1장.txt')
  const b = file('2장.DOCX')
  const first = queue(a)
  const { items, errors } = appendManuscriptFiles(first, [b, a, b, file('1장.txt', '수정한 원고', 2)])
  assert.deepEqual(items.map((item) => item.file.name), ['1장.txt', '2장.DOCX', '1장.txt'])
  assert.deepEqual(errors, [])
  assert.equal(first.length, 1)
})

test('mixed selections keep valid files and report unsupported, empty, or oversized files before creating manuscripts', () => {
  const oversized = { name: '큰 원고.txt', size: MAX_MANUSCRIPT_BYTES + 1, lastModified: 1 }
  const { items, errors } = appendManuscriptFiles([], [file('좋은 원고.txt'), file('지원 안 됨.pdf'), file('빈 원고.txt', ''), oversized])
  assert.equal(items.length, 1)
  assert.equal(errors.length, 3)
  assert.ok(errors[0].includes('지원 안 됨.pdf'))
  assert.ok(errors[1].includes('빈 파일'))
  assert.ok(errors[2].includes('20MB'))
  assert.equal(validateManuscriptFile({ ...oversized, size: MAX_MANUSCRIPT_BYTES }), null)
})

test('partial upload failure does not stop the batch; retry reuses its manuscript and skips successful files', async () => {
  const created = []
  const uploaded = []
  const states = []
  let fail = true
  const actions = {
    create: async (f) => { created.push(f.name); return `id:${f.name}` },
    upload: async (id, f) => {
      uploaded.push([id, f.name])
      if (fail && f.name === '2.txt') throw new Error('연결 끊김')
    },
    describeError: (error) => error.message,
    changed: (items) => states.push(items),
  }
  const result = await runManuscriptUploads(queue(file('1.txt'), file('2.txt'), file('3.txt')), actions)
  assert.deepEqual(result.map((item) => item.status), ['uploaded', 'failed', 'uploaded'])
  assert.equal(result[1].manuscriptId, 'id:2.txt')
  assert.equal(result[1].error, '연결 끊김')
  assert.ok(states.some((items) => items[1].status === 'uploading' && items[1].manuscriptId === 'id:2.txt'))
  fail = false
  const retried = await runManuscriptUploads(result, actions)
  assert.equal(created.length, 3)
  assert.deepEqual(uploaded.at(-1), ['id:2.txt', '2.txt'])
  assert.equal(uploaded.length, 4)
  assert.ok(retried.every((item) => item.status === 'uploaded' && !item.error))
  assert.equal(result[1].status, 'failed')
})

test('creation failure remains retryable and per-file retry leaves other queued files alone', async () => {
  let fail = true
  let uploads = 0
  const actions = {
    create: async (f) => {
      if (fail && f.name === '1.txt') throw new Error('생성 실패')
      return f.name
    },
    upload: async () => { uploads++ },
    describeError: (error) => error.message,
    changed: () => {},
  }
  const selected = queue(file('1.txt'), file('2.txt'))
  const result = await runManuscriptUploads(selected, actions, selected[0].key)
  assert.equal(result[0].status, 'failed')
  assert.equal(result[0].manuscriptId, undefined)
  assert.equal(result[1].status, 'queued')
  assert.equal(uploads, 0)
  fail = false
  const retried = await runManuscriptUploads(result, actions, selected[0].key)
  assert.equal(retried[0].status, 'uploaded')
  assert.equal(retried[1].status, 'queued')
  assert.equal(uploads, 1)
})
