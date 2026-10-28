import { NavLink, useLocation } from 'react-router-dom'
import { projectPath } from '../app/currentProject'
import './insights.css'

export function InsightNav({ projectId }: { projectId: string }) {
  const { search } = useLocation()
  const current = new URLSearchParams(search)
  const context = new URLSearchParams()
  for (const key of ['manuscript', 'chapter']) {
    if (current.has(key)) context.set(key, current.get(key)!)
  }
  const suffix = context.size ? `?${context}` : ''
  return (
    <nav className="insight-nav" aria-label="작품 살펴보기">
      {[
        ['story-map', '이야기 흐름'],
        ['relationships', '인물 관계'],
        ['foreshadowings', '복선'],
        ['conflicts', '설정 검토'],
      ].map(([path, title]) => (
        <NavLink key={path} to={`${projectPath(projectId, path)}${suffix}`}>
          {title}
        </NavLink>
      ))}
    </nav>
  )
}
