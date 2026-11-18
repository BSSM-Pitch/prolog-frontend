import { test } from 'node:test'
import assert from 'node:assert/strict'
import { foreshadowingManuscript, scopedForeshadowings, eligibleChapters } from '../src/features/insights/manuscriptScopeModel.ts'

test('same-number chapters in another draft do not mix into the selected manuscript', () => {
  const a = {chapter_locations: [{role: 'setup', chapter: 1, manuscript_id: 'original'}]}
  const b = {chapter_locations: [{role: 'setup', chapter: 1, manuscript_id: 'restored'}]}
  assert.deepEqual(scopedForeshadowings([a,b], 'original', true), [a])
  assert.deepEqual(scopedForeshadowings([a,b], 'restored', true), [b])
})

test('deleted setups retain ownership from surviving evidence without guessing among drafts', () => {
  assert.equal(foreshadowingManuscript({chapter_locations: [{role: 'linked', chapter: 4, manuscript_id: 'a'}]}), 'a')
  assert.equal(foreshadowingManuscript({chapter_locations: []}), null)
  assert.equal(foreshadowingManuscript({chapter_locations: [
    {role: 'linked', chapter: 4, manuscript_id: 'a'}, {role: 'payoff', chapter: 8, manuscript_id: 'b'},
  ]}), null)
})

test('chapter choices use actual non-contiguous chapters and allow same-chapter payoff', () => {
  assert.deepEqual(eligibleChapters([1,3,8,3], 3), [3,8])
  assert.deepEqual(eligibleChapters([1,3,8], 1, 3), [1,3])
  assert.deepEqual(eligibleChapters([1,3,8], 1, Infinity, [1,8]), [3])
})
