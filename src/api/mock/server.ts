import type { RawResponse } from '../client'
import { fillProjectWithDemo, loadDb, saveDb } from './db'
import { completeDemoReview } from './routes/world'
import { fail, type MockRequest, type Route } from './http'
import { authRoutes } from './routes/auth'
import { characterRoutes } from './routes/characters'
import { foreshadowingRoutes } from './routes/foreshadowings'
import { manuscriptRoutes } from './routes/manuscripts'
import { notificationRoutes } from './routes/notifications'
import { memberRoutes } from './routes/members'
import { projectRoutes } from './routes/projects'
import { qaRoutes } from './routes/qa'
import { relationshipRoutes } from './routes/relationships'
import { storyRoutes } from './routes/story'
import { teamRoutes } from './routes/teams'
import { worldRoutes } from './routes/world'

// 브라우저 안에서 도는 목업 API 서버. 실제 백엔드가 준비되면 VITE_API_MODE=real로 바꾼다.

const LATENCY_MS = 350

const routes: Route[] = [...authRoutes, ...projectRoutes, ...memberRoutes, ...manuscriptRoutes, ...qaRoutes, ...characterRoutes, ...worldRoutes, ...relationshipRoutes, ...foreshadowingRoutes, ...storyRoutes, ...teamRoutes, ...notificationRoutes]

function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/')
  const s = path.split('/')
  if (p.length !== s.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i])
    else if (p[i] !== s[i]) return null
  }
  return params
}

export async function handleMockRequest(req: MockRequest): Promise<RawResponse> {
  await new Promise((r) => setTimeout(r, LATENCY_MS))
  // 고정 경로(/projects/new 같은)가 파라미터 경로보다 먼저 맞도록, 파라미터가 적은 패턴부터 본다
  const candidates = routes
    .filter(([method]) => method === req.method)
    .map(([, pattern, handler]) => ({ handler, params: match(pattern, req.path), dynamic: (pattern.match(/:/g) ?? []).length }))
    .filter((c) => c.params !== null)
    .sort((a, b) => a.dynamic - b.dynamic)
  const hit = candidates[0]
  if (!hit) return fail(404, 'NOT_FOUND', `목업에 없는 API예요: ${req.method} ${req.path}`)

  const db = loadDb()
  const res = await hit.handler(req, db, hit.params!)
  saveDb(db)
  return res
}

/** 작품 제목 또는 ID로 시연 이야기를 채우고, 원고 검사까지 마친 상태로 만든다 */
function fillDemo(titleOrId: string): { ok: true; projectId: string; message: string } | { ok: false; message: string } {
  const db = loadDb()
  const matches = db.projects.filter((p) => p.project_id === titleOrId || p.title === titleOrId)
  if (matches.length !== 1)
    return {
      ok: false,
      message: matches.length
        ? `같은 제목의 작품이 ${matches.length}개예요. ID로 지정해 주세요: ${matches.map((p) => p.project_id).join(', ')}`
        : `작품을 찾지 못했어요: ${titleOrId}`,
    }
  const project = matches[0]
  fillProjectWithDemo(db, project.project_id)
  completeDemoReview(db, project.project_id)
  saveDb(db)
  return { ok: true, projectId: project.project_id, message: `‘${project.title}’에 시연 원고·인물·관계·복선을 채우고 원고 검사를 마쳤어요.` }
}

/**
 * 개발 도우미 (목업 모드 · 개발 서버에서만).
 *   주소에 ?mock-demo=작품제목 을 붙여 열면 그 작품을 채우고 인물 관계 화면으로 옮긴다.
 *   콘솔: prologMock.fillDemo('작품 제목 또는 ID'), prologMock.projects()
 */
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { prologMock: unknown }).prologMock = {
    projects: () => loadDb().projects.map((p) => ({ id: p.project_id, title: p.title })),
    fillDemo: (titleOrId: string) => fillDemo(titleOrId).message,
  }
  const target = new URLSearchParams(window.location.search).get('mock-demo')
  if (target) {
    const result = fillDemo(target)
    if (result.ok) window.location.replace(`/projects/${result.projectId}/relationships`)
    else {
      window.alert(result.message)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }
}
