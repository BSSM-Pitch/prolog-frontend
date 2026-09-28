import type { RawResponse } from '../client'
import type { MockDb, MockUser } from './db'

export interface MockRequest {
  method: string
  path: string
  query: Record<string, string>
  headers: Record<string, string>
  body: unknown
}

export type Body = Record<string, unknown>
export type Handler = (req: MockRequest, db: MockDb, params: Record<string, string>) => RawResponse | Promise<RawResponse>
export type Route = [method: string, pattern: string, handler: Handler]

export const ok = (status: number, data: unknown, meta: Body = {}): RawResponse => ({ status, body: { data, meta } })
export const fail = (status: number, code: string, message: string, details: Body = {}): RawResponse => ({
  status,
  body: { error: { code, message, details } },
})
export const noContent = (): RawResponse => ({ status: 204, body: null })

export const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
export const lower = (v: string) => v.toLowerCase()

export function stamp() {
  return new Date().toISOString()
}

export function nextId(db: MockDb, prefix: string) {
  db.seq += 1
  return `${prefix}_${db.seq}`
}

/** Authorization 헤더의 액세스 토큰으로 사용자를 찾는다. 실패하면 401 응답을 돌려준다. */
export function authenticate(req: MockRequest, db: MockDb): MockUser | RawResponse {
  const token = (req.headers.Authorization ?? '').replace(/^Bearer /, '')
  const record = db.accessTokens[token]
  if (!record || record.expires_at < Date.now()) return fail(401, 'UNAUTHORIZED', '로그인이 필요해요.')
  return db.users.find((u) => u.user_id === record.user_id) ?? fail(404, 'USER_NOT_FOUND', '사용자를 찾을 수 없어요.')
}

export const isResponse = <T extends object>(v: T | RawResponse): v is RawResponse => 'status' in v && 'body' in v

/** 목록 공통 커서 페이지네이션 (limit 기본 20 · 최대 100) */
export function paginate<T>(req: MockRequest, rows: T[]) {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 20) || 20, 1), 100)
  const offset = req.query.cursor ? Number(atob(req.query.cursor)) || 0 : 0
  const page = rows.slice(offset, offset + limit)
  const next_cursor = offset + limit < rows.length ? btoa(String(offset + limit)) : null
  return { page, next_cursor }
}
