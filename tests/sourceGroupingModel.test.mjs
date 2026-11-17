import test from 'node:test'
import assert from 'node:assert/strict'
import { groupSourceRecords } from '../src/features/characters/detailModel.ts'

test('same source groups classifications without losing IDs or merging distinct occurrences', () => {
  const ev = { scene_id: 'scene-a', revision: 'r', start: 3, end: 7, quote: '같은 문장' }
  const rows = [
    { observation_id: 'a', kind: 'action', evidence: ev },
    { observation_id: 'b', kind: 'narration', evidence: ev },
    { observation_id: 'c', kind: 'action', evidence: { ...ev, start: 20, end: 24 } },
    { observation_id: 'd', kind: 'action', evidence: { ...ev, scene_id: 'scene-b' } },
  ]
  const grouped = groupSourceRecords(rows)
  assert.deepEqual(grouped.map(g => g.map(r => r.observation_id)), [['a', 'b'], ['c'], ['d']])
  assert.deepEqual(grouped.flat(), rows)
})
