import type { RawResponse } from '../client'
import { loadDb, saveDb } from './db'
import { fail, type MockRequest, type Route } from './http'
import { authRoutes } from './routes/auth'
import { characterRoutes } from './routes/characters'
import { foreshadowingRoutes } from './routes/foreshadowings'
import { manuscriptRoutes } from './routes/manuscripts'
import { memberRoutes } from './routes/members'
import { projectRoutes } from './routes/projects'
import { qaRoutes } from './routes/qa'
import { relationshipRoutes } from './routes/relationships'
import { storyRoutes } from './routes/story'
import { worldRoutes } from './routes/world'

// 브라우저 안에서 도는 목업 API 서버. 실제 백엔드가 준비되면 VITE_API_MODE=real로 바꾼다.

const LATENCY_MS = 350

const routes: Route[] = [...authRoutes, ...projectRoutes, ...memberRoutes, ...manuscriptRoutes, ...qaRoutes, ...characterRoutes, ...worldRoutes, ...relationshipRoutes, ...foreshadowingRoutes, ...storyRoutes]

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
