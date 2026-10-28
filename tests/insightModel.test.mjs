import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  chapterAt,
  chapterPosition,
  foreshadowStages,
  pageOf,
  relationshipView,
  snapshotAt,
} from '../src/features/insights/insightModel.ts'

const people = Array.from({ length: 31 }, (_, i) => ({
  character_id: `p${i}`,
  name: `인물 ${String(i).padStart(2, '0')}`,
}))
const history = (chapter, state) => ({ chapter, state, trust: null, event_title: null, event_deleted: false })
const relation = (i, entries = [history(1, '우호')]) => ({
  relationship_id: `r${i}`,
  source_character_id: 'p0',
  target_character_id: `p${i}`,
  history: entries,
})

test('chapter snapshots sort records and never show future states', () => {
  const row = relation(1, [history(20, '신뢰'), history(1, '우호'), history(10, '갈등')])
  assert.equal(snapshotAt(row, 9).state, '우호')
  assert.equal(snapshotAt(row, 10).state, '갈등')
  assert.equal(snapshotAt(row, 19).chapter, 10)
  assert.equal(snapshotAt(row, 0), null)
  assert.equal(row.history[0].chapter, 20)
})

test('a crowded graph is limited to one center and six direct neighbors per view', () => {
  const rows = people.slice(1).map((_, i) => relation(i + 1))
  const view = relationshipView(people, rows, 1, null, 1)
  assert.equal(view.center.character_id, 'p0')
  assert.equal(view.rows.length, 6)
  assert.equal(view.count, 5)
  const pages = Array.from({ length: 5 }, (_, i) => relationshipView(people, rows, 1, 'p0', i + 1))
  assert.equal(new Set(pages.flatMap((page) => page.rows.map((row) => row.person.character_id))).size, 30)
  assert.equal(relationshipView(people, rows, 1, 'p12', 1).rows.length, 1)
})

test('missing people, self edges and unrecorded future relations do not appear', () => {
  const rows = [relation(1, [history(10, '갈등')]), relation(99), relation(0)]
  assert.equal(relationshipView(people, rows, 5, 'p0', 1).neighbors.length, 0)
  assert.equal(relationshipView(people, rows, 10, 'p0', 1).neighbors.length, 1)
  assert.equal(relationshipView(people, rows, 5, 'p4', 1).center.character_id, 'p4')
  assert.equal(relationshipView([], rows, 5, null, 1).center, null)
})

test('chapter and page inputs remain bounded', () => {
  assert.equal(chapterAt(-1, 27), 27)
  assert.equal(chapterAt(Infinity, 27), 27)
  assert.equal(chapterAt(500, 27), 27)
  assert.equal(chapterAt(4.5, 27), 4)
  assert.equal(pageOf(people, 999).page, 6)
  assert.equal(pageOf(people, NaN).page, 1)
  assert.equal(pageOf([], 100).count, 1)
})

test('foreshadow stages preserve their role and chronology while deduplicating chapter links', () => {
  const stages = foreshadowStages({
    status: 'resolved',
    setup_chapter: 2,
    linked_chapters: [9, 5, 5, 0],
    payoff_chapter: 20,
  })
  assert.deepEqual(
    stages.map((stage) => [stage.chapter, stage.role]),
    [
      [2, 'setup'],
      [5, 'linked'],
      [9, 'linked'],
      [20, 'payoff'],
    ],
  )
})

test('deleted setup chapters do not create a fictitious chapter zero', () => {
  const stages = foreshadowStages({ status: 'orphaned', setup_chapter: 0, linked_chapters: [5], payoff_chapter: null })
  assert.deepEqual(
    stages.map((stage) => stage.chapter),
    [5],
  )
  assert.equal(chapterPosition(1, 1), 0)
  assert.equal(chapterPosition(-10, 27), 0)
  assert.equal(chapterPosition(500, 27), 100)
})
