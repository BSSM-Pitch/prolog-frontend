import test from 'node:test'
import assert from 'node:assert/strict'
import { discoverySummary, uniqueCandidates } from '../src/features/characters/discoveryModel.ts'

const candidate = (name, status, character_id = null) => ({ name, status, character_id })

test('overlapping chunks count each added or existing character once', () => {
  const rows = [
    candidate('서윤하', 'added', 'a'),
    candidate('서윤하', 'added', 'a'),
    candidate('윤하', 'existing', 'a'),
    candidate('모윤재', 'existing', 'b'),
    candidate('모윤재', 'existing', 'b'),
    candidate('경비장', 'needs_review'),
    candidate('경비장', 'needs_review'),
  ]
  const summary = discoverySummary(rows)
  assert.equal(summary.added, 1)
  assert.equal(summary.existing, 1)
  assert.deepEqual(
    summary.review.map((c) => c.name),
    ['경비장'],
  )
})

test('resolved and dismissed candidates no longer require review', () => {
  assert.deepEqual(discoverySummary([candidate('집사', 'dismissed'), candidate('윤하', 'confirmed', 'a')]), {
    added: 0,
    existing: 0,
    review: [],
  })
  assert.equal(uniqueCandidates([candidate('Peter', 'existing', 'a'), candidate('peter', 'existing', 'a')]).length, 1)
})
