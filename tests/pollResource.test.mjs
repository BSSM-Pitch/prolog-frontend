import test from 'node:test'
import assert from 'node:assert/strict'
import { pollResource } from '../src/lib/pollResource.ts'
const tick = () => new Promise((resolve) => setImmediate(resolve))
const deferred = () => {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

test('leaving a screen ignores its late response; returning reads the same server job', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const pending = deferred()
  const oldValues = []
  const stop = pollResource({ load: () => pending.promise, onValue: (v) => oldValues.push(v), onError: assert.fail, delay: () => 1000 })
  stop()
  pending.resolve({ id: 'same-job', status: 'running' })
  await tick()
  assert.deepEqual(oldValues, [])
  let serverJob = { id: 'same-job', status: 'running' }
  const values = []
  const resumed = pollResource({ load: async () => serverJob, onValue: (v) => values.push(v), onError: assert.fail, delay: () => 1000 })
  await tick()
  serverJob = { id: 'same-job', status: 'completed', candidates: ['rule-1'] }
  t.mock.timers.tick(1000)
  await tick()
  resumed()
  assert.equal(values[0].id, values[1].id)
  assert.deepEqual(values[1].candidates, ['rule-1'])
})

test('polls never overlap and a temporary error does not stop recovery', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const first = deferred()
  let calls = 0
  const errors = [], values = []
  const stop = pollResource({
    load: async () => { calls++; if (calls === 1) return first.promise; if (calls === 2) throw Error('offline'); return 'completed' },
    onValue: (v) => values.push(v), onError: (e) => errors.push(e.message), delay: () => 1000,
  })
  t.mock.timers.tick(10000)
  assert.equal(calls, 1)
  first.resolve('running')
  await tick()
  t.mock.timers.tick(1000)
  await tick()
  t.mock.timers.tick(1000)
  await tick()
  stop()
  assert.deepEqual(values, ['running', 'completed'])
  assert.deepEqual(errors, ['offline'])
})

test('idle polling finds a request accepted after navigation without creating a new job', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let jobs = [], shown = null
  const stop = pollResource({ load: async () => jobs, onValue: (v) => { shown = v }, onError: assert.fail, delay: () => 10000 })
  await tick()
  jobs = [{ id: 'accepted-late', status: 'queued' }]
  t.mock.timers.tick(10000)
  await tick()
  stop()
  assert.equal(shown[0].id, 'accepted-late')
})
