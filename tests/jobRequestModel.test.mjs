import test from 'node:test'
import assert from 'node:assert/strict'
import { createJobRequest } from '../src/lib/jobRequestModel.ts'
const deferred = () => {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
function fixture() {
  const events = []
  const request = createJobRequest({
    onBusy: (busy) => events.push(['busy', busy]),
    onResult: (job) => events.push(['result', job]),
    onError: (error) => events.push(['error', error.message]),
  })
  return { request, events }
}

test('shows pending immediately and accepts cached completion without waiting for polling', async () => {
  const { request, events } = fixture()
  const reply = deferred()
  const pending = request.run(() => reply.promise)
  assert.deepEqual(events, [['busy', true]])
  const cached = { job_id: 'existing', status: 'completed', result_ids: [] }
  reply.resolve(cached)
  await pending
  assert.deepEqual(events, [['busy', true], ['result', cached], ['busy', false]])
})

test('rapid clicks buy only one submission, then allow another after completion', async () => {
  const { request } = fixture()
  let calls = 0
  const reply = deferred()
  const send = () => { calls++; return reply.promise }
  const first = request.run(send)
  await request.run(send)
  assert.equal(calls, 1)
  reply.resolve({ status: 'queued' })
  await first
  await request.run(send)
  assert.equal(calls, 2)
})

test('HTTP failure is surfaced, pending clears, and retry succeeds', async () => {
  const { request, events } = fixture()
  await request.run(async () => { throw Error('offline') })
  await request.run(async () => ({ status: 'queued' }))
  assert.deepEqual(events, [
    ['busy', true], ['error', 'offline'], ['busy', false],
    ['busy', true], ['result', { status: 'queued' }], ['busy', false],
  ])
})

test('leaving a manuscript ignores a late completion without clearing a newer request', async () => {
  const { request, events } = fixture()
  const old = deferred(), next = deferred()
  const first = request.run(() => old.promise)
  request.reset()
  const second = request.run(() => next.promise)
  old.resolve({ job_id: 'old', status: 'completed' })
  await first
  assert.deepEqual(events, [['busy', true], ['busy', true]])
  next.resolve({ job_id: 'new', status: 'queued' })
  await second
  assert.deepEqual(events.slice(2), [['result', { job_id: 'new', status: 'queued' }], ['busy', false]])
})

test('late failures from a previous screen are ignored too', async () => {
  const { request, events } = fixture()
  const reply = deferred()
  const pending = request.run(() => reply.promise)
  request.reset()
  reply.reject(Error('old failure'))
  await pending
  assert.deepEqual(events, [['busy', true]])
})
