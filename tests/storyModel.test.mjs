import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eventConnections, eventPage, keyEvents, orderedEvents } from '../src/features/story/storyModel.ts'

const event = (chapter, type = 'event') => ({
  node_id: `n${chapter}`,
  chapter,
  type,
  title: `사건 ${chapter}`,
  summary: '',
  characters: [],
})

test('major view keeps the beginning, turning points, climax and ending in chapter order', () => {
  const nodes = [event(9), event(5, 'turning_point'), event(1), event(7, 'climax'), event(3)]
  assert.deepEqual(
    keyEvents(nodes).map((node) => node.chapter),
    [1, 5, 7, 9],
  )
  assert.equal(nodes[0].chapter, 9, 'server data must not be reordered in place')
})

test('unclassified stories do not lose their middle events', () => {
  assert.deepEqual(
    keyEvents([event(1), event(2), event(3)]).map((node) => node.chapter),
    [1, 2, 3],
  )
  assert.deepEqual(keyEvents([]), [])
  assert.equal(keyEvents([event(1)]).length, 1)
})

test('unknown chapter locations remain unknown and appear after located events', () => {
  assert.deepEqual(
    orderedEvents([event(0), event(2), event(1)]).map((node) => node.chapter),
    [1, 2, 0],
  )
})

test('long stories are bounded to six events per page without dropping events', () => {
  const nodes = Array.from({ length: 101 }, (_, i) => event(i + 1))
  const pages = Array.from({ length: 17 }, (_, i) => eventPage(nodes, i + 1))
  assert.ok(pages.every((page) => page.nodes.length <= 6))
  assert.deepEqual(
    pages.flatMap((page) => page.nodes),
    nodes,
  )
  assert.equal(eventPage(nodes, 999).page, 17)
  assert.equal(eventPage(nodes, -1).page, 1)
  assert.equal(eventPage(nodes, NaN).page, 1)
  assert.equal(eventPage([], 10).page, 1)
})

test('connections retain direction and never turn unknown relations into causes', () => {
  const map = {
    nodes: [event(1), event(2), event(3), event(4)],
    edges: [
      { from_node_id: 'n1', to_node_id: 'n2', relation: 'causes' },
      { from_node_id: 'n2', to_node_id: 'n3', relation: 'affects' },
      { from_node_id: 'n4', to_node_id: 'n2', relation: 'parallel' },
    ],
  }
  assert.deepEqual(
    eventConnections(map, 'n2').map(({ node, label }) => [node.chapter, label]),
    [
      [1, '원인이 된 사건'],
      [3, '영향을 받은 사건'],
      [4, '관련 사건'],
    ],
  )
  assert.equal(eventConnections(map, 'n1')[0].label, '결과로 이어진 사건')
  assert.equal(eventConnections(map, 'n3')[0].label, '영향을 준 사건')
})

test('dangling, duplicate, self and unrelated edges cannot crowd the selected event', () => {
  const edge = { from_node_id: 'n1', to_node_id: 'n2', relation: 'causes' }
  const map = {
    nodes: [event(1), event(2), event(3)],
    edges: [
      edge,
      edge,
      { from_node_id: 'missing', to_node_id: 'n2', relation: 'causes' },
      { from_node_id: 'n2', to_node_id: 'n2', relation: 'affects' },
      { from_node_id: 'n1', to_node_id: 'n3', relation: 'causes' },
    ],
  }
  assert.equal(eventConnections(map, 'n2').length, 1)
})
