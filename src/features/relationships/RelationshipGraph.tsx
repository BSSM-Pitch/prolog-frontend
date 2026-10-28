import { useEffect, useRef, useState } from 'react'
import type { relationshipView } from '../insights/insightModel'

type View = ReturnType<typeof relationshipView>

export function RelationshipGraph({
  view,
  selectedId,
  onPerson,
  onRelationship,
}: {
  view: View
  selectedId: string | null
  onPerson: (id: string) => void
  onRelationship: (id: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < 560))
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  const height = compact ? 120 + view.rows.length * 100 : 460
  const center = { x: 50, y: compact ? 38 : height / 2 }
  const positions = view.rows.map((_, index) => {
    if (compact) return { x: 76, y: 145 + index * 100, labelX: 34, labelY: 145 + index * 100 }
    const left = index % 2 === 0
    const count = Math.ceil((view.rows.length - (left ? 0 : 1)) / 2)
    const y = count === 1 ? height / 2 : 60 + (Math.floor(index / 2) / (count - 1)) * (height - 120)
    return { x: left ? 11 : 89, y, labelX: left ? 30 : 70, labelY: (y + center.y) / 2 }
  })
  return (
    <div
      className={`relation-graph${compact ? ' relation-graph--compact' : ''}`}
      ref={container}
      style={{ height }}
      role="group"
      aria-label={`${view.center?.name} 중심의 인물 관계 그래프`}
    >
      <svg viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {view.rows.map((item, index) => {
          const point = positions[index]
          const left = point.x < 50
          const path = compact
            ? `M500 70 V95 H160 V${point.y} H550`
            : `M${left ? 410 : 590} ${center.y} C${left ? 310 : 690} ${center.y}, ${left ? 290 : 710} ${point.y}, ${left ? 200 : 800} ${point.y}`
          return (
            <path
              key={item.relationship.relationship_id}
              d={path}
              className={selectedId === item.relationship.relationship_id ? 'is-selected' : ''}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
      <div className="relation-graph__person relation-graph__center" style={{ left: `${center.x}%`, top: center.y }}>
        <strong>{view.center?.name}</strong>
      </div>
      {view.rows.map((item, index) => {
        const point = positions[index]
        return (
          <div key={item.relationship.relationship_id}>
            <button
              type="button"
              className="relation-graph__person"
              style={{ left: `${point.x}%`, top: point.y }}
              onClick={() => onPerson(item.person.character_id)}
              aria-label={`${item.person.name} 중심으로 보기`}
            >
              <strong>{item.person.name}</strong>
            </button>
            <button
              type="button"
              className="relation-graph__edge"
              style={{ left: `${point.labelX}%`, top: point.labelY }}
              aria-pressed={selectedId === item.relationship.relationship_id}
              aria-label={`${view.center?.name}, ${item.person.name}: ${item.snapshot.state} 관계 보기`}
              onClick={() => onRelationship(item.relationship.relationship_id)}
            >
              {item.snapshot.state}
            </button>
          </div>
        )
      })}
    </div>
  )
}
