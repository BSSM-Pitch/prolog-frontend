import type { StructureMap, StructureNode } from '../../api/types'

export const EVENTS_PER_PAGE = 6

export function orderedEvents(nodes: StructureNode[]) {
  // 장을 특정하지 못한 분석 결과는 마지막에 둔다. 없는 장 번호를 만들어 내지 않는다.
  return [...nodes].sort((a, b) => (a.chapter > 0 ? a.chapter : Infinity) - (b.chapter > 0 ? b.chapter : Infinity))
}

export function keyEvents(nodes: StructureNode[]) {
  const sorted = orderedEvents(nodes)
  if (!sorted.some((node) => node.type !== 'event')) return sorted
  return sorted.filter((node, i) => i === 0 || i === sorted.length - 1 || node.type !== 'event')
}

export function eventPage(nodes: StructureNode[], requested: number) {
  const count = Math.max(1, Math.ceil(nodes.length / EVENTS_PER_PAGE))
  const page = Number.isFinite(requested) ? Math.min(count, Math.max(1, Math.floor(requested))) : 1
  return { page, count, nodes: nodes.slice((page - 1) * EVENTS_PER_PAGE, page * EVENTS_PER_PAGE) }
}

export function eventConnections(map: StructureMap, selectedId: string) {
  const byId = new Map(map.nodes.map((node) => [node.node_id, node]))
  const seen = new Set<string>()
  return map.edges.flatMap((edge) => {
    const incoming = edge.to_node_id === selectedId
    if (!incoming && edge.from_node_id !== selectedId) return []
    const node = byId.get(incoming ? edge.from_node_id : edge.to_node_id)
    const key = `${incoming}:${node?.node_id}:${edge.relation}`
    if (!node || node.node_id === selectedId || seen.has(key)) return []
    seen.add(key)
    const label =
      edge.relation === 'causes'
        ? incoming
          ? '원인이 된 사건'
          : '결과로 이어진 사건'
        : edge.relation === 'affects'
          ? incoming
            ? '영향을 준 사건'
            : '영향을 받은 사건'
          : '관련 사건'
    return [{ node, label, key }]
  })
}
