import assert from 'node:assert/strict'
import test from 'node:test'
import { visibleRecords, periodLabel, patternRecords } from '../src/features/characters/detailModel.ts'
import { exactMemoryRange } from '../src/features/manuscripts/manuscriptReviewModel.ts'

const row = (id, kind, quote) => ({
  observation_id: id,
  kind,
  summary: '짧은 대답',
  context: '문 앞',
  evidence: { quote },
  interlocutors: ['서진'],
})
const data = {
  observations: [row('a', 'speech', '괜찮아.'), row('b', 'action', '손이 떨렸다.')],
  uncertain_observations: [row('u', 'speech', '몰라.')],
}

test('uncertain attribution never enters ordinary or metric evidence results', () => {
  assert.deepEqual(
    visibleRecords(data, 'all', '', null).map((r) => r.observation_id),
    ['a', 'b'],
  )
  assert.deepEqual(
    visibleRecords(data, 'uncertain', '', null).map((r) => r.observation_id),
    ['u'],
  )
  assert.equal(visibleRecords(data, 'all', '', ['u']).length, 0)
})

test('patterns resolve shared source records without duplicating or inventing evidence', () => {
  const [pattern] = patternRecords(
    [{ supporting_observation_ids: ['a'], counterexample_observation_ids: ['b'] }],
    data.observations,
  )
  assert.equal(pattern.support[0], data.observations[0])
  assert.equal(pattern.counterexamples[0], data.observations[1])
})
test('metric evidence, source text, partner names and category filters compose', () => {
  assert.equal(visibleRecords(data, 'all', '손이', ['b']).length, 1)
  assert.equal(visibleRecords(data, 'speech', '손이', null).length, 0)
  assert.equal(visibleRecords(data, 'all', '서진', null).length, 2)
  assert.equal(visibleRecords(data, 'all', '', []).length, 0)
  assert.equal(periodLabel([4, 5, 6]), '4–6 구간')
})
test('repeated dialogue selects its exact occurrence after emoji, never a different match', () => {
  const text = '🌙 괜찮아. 다시 괜찮아.'
  const points = Array.from(text)
  const start = points.join('').lastIndexOf('괜찮아.') - 1
  const range = exactMemoryRange(text, '괜찮아.', start, start + 4)
  assert.equal(text.slice(range.start, range.end), '괜찮아.')
  assert.equal(range.start, text.lastIndexOf('괜찮아.'))
  assert.equal(exactMemoryRange('추가된 ' + text, '괜찮아.', start, start + 4), null)
  assert.equal(exactMemoryRange(text, '괜찮아.', -1, 3), null)
})
