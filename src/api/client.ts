import { API_BASE_URL, IS_REAL, servedByBackend } from './config'
import { setCurrentUserId } from './identity'
import { bridgeUser, mirrorProject } from './mock/bridge'
import { handleMockRequest } from './mock/server'
import type { ApiErrorBody, User } from './types'

// VITE_API_MODE=real 이면 백엔드에 있는 API는 실제 서버로, 없는 API는 목업으로 보낸다(혼합 모드).
// mock 이면 전부 브라우저 안의 목업 서버가 받는다.

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: Record<string, unknown>

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.details = body.details ?? {}
  }
}

export interface RawResponse {
  status: number
  body: unknown
}

interface RequestOptions {
  body?: unknown
  query?: Record<string, string>
  accessToken?: string
}

function headersOf(options: RequestOptions) {
  const headers: Record<string, string> = {}
  if (options.body !== undefined && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`
  return headers
}

async function sendReal(method: string, path: string, options: RequestOptions): Promise<RawResponse> {
  const query = options.query ? `?${new URLSearchParams(options.query)}` : ''
  const body = options.body
  const res = await fetch(`${API_BASE_URL}${path}${query}`, {
    method,
    headers: headersOf(options),
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  })
  const json = res.status === 204 ? null : await res.json().catch(() => null)
  return { status: res.status, body: json }
}

// --- 혼합 모드: 목업이 받는 API(AI 분석·캐릭터 등)도 실제 프로젝트·원고를 알아야 한다 ------------
// 목업으로 보내기 전에 그 프로젝트의 실제 데이터(프로젝트·멤버·원고·장)를 목업 DB에 옮겨 둔다.

const MIRROR_TTL_MS = 3000
const mirroredAt = new Map<string, number>()

const projectIdOf = (path: string) => /^\/projects\/([^/]+)/.exec(path)?.[1] ?? null

async function realData<T>(path: string, token: string, query?: Record<string, string>): Promise<T> {
  const res = await sendReal('GET', path, { accessToken: token, query })
  const body = res.body as { data?: T; error?: ApiErrorBody } | null
  if (res.status >= 400) throw new ApiError(res.status, body?.error ?? { code: 'UNKNOWN_ERROR', message: '실제 서버에서 데이터를 가져오지 못했어요.', details: {} })
  return body?.data as T
}

/** 커서 목록을 끝까지 받는다 (백엔드 기본 20개 · 최대 100개) */
async function realAll<T>(path: string, token: string, query: Record<string, string> = {}): Promise<T[]> {
  const out: T[] = []
  let cursor: string | null = null
  do {
    const res = await sendReal('GET', path, { accessToken: token, query: { ...query, limit: '100', ...(cursor ? { cursor } : {}) } })
    const body = res.body as { data?: T[]; meta?: { next_cursor?: string | null }; error?: ApiErrorBody } | null
    if (res.status >= 400) throw new ApiError(res.status, body?.error ?? { code: 'UNKNOWN_ERROR', message: '실제 서버에서 데이터를 가져오지 못했어요.', details: {} })
    out.push(...(body?.data ?? []))
    cursor = body?.meta?.next_cursor ?? null
  } while (cursor)
  return out
}

async function ensureMirror(projectId: string, token: string) {
  const at = mirroredAt.get(projectId)
  if (at && Date.now() - at < MIRROR_TTL_MS) return
  const list = <T>(sub: string) => realAll<T>(`/projects/${projectId}/${sub}`, token)
  const [project, members, manuscripts, chapters, characters, rules, foreshadowings] = await Promise.all([
    realData<Record<string, unknown>>(`/projects/${projectId}`, token),
    list<Record<string, unknown>>('members'),
    list<Record<string, unknown>>('manuscripts'),
    list<Record<string, unknown>>('chapters'),
    list<Record<string, unknown>>('characters'),
    list<Record<string, unknown>>('world-rules'),
    list<Record<string, unknown>>('foreshadowings'),
  ])
  mirrorProject({ project, members, manuscripts, chapters, characters, rules, foreshadowings })
  mirroredAt.set(projectId, Date.now())
}

/** 실제 서버에서 프로젝트 데이터를 바꿨으면 다음 목업 요청 전에 다시 옮긴다 */
function invalidateMirror(path: string) {
  const id = projectIdOf(path)
  if (id) mirroredAt.delete(id)
}

/** 로그인한 사용자를 목업에도 알려 준다 (목업 API의 인증·권한 확인용) */
function rememberUser(path: string, body: unknown) {
  const data = (body as { data?: unknown } | null)?.data as { user?: User; user_id?: string } | undefined
  if (!data) return
  const user = path === '/users/me' && data.user_id ? (data as User) : data.user
  if (!user) return
  setCurrentUserId(user.user_id)
  bridgeUser(user)
}

async function send(method: string, path: string, options: RequestOptions, forceMock = false): Promise<RawResponse> {
  if (!forceMock && servedByBackend(method, path)) {
    const res = await sendReal(method, path, options)
    if (res.status < 400) {
      if (method !== 'GET') invalidateMirror(path)
      rememberUser(path, res.body)
    }
    return res
  }
  if (IS_REAL) {
    const projectId = projectIdOf(path)
    if (projectId && forceMock) mirroredAt.delete(projectId)
    if (projectId && options.accessToken) await ensureMirror(projectId, options.accessToken)
  }
  return handleMockRequest({ method, path, query: options.query ?? {}, headers: headersOf(options), body: options.body })
}

/** 공통 응답 포맷 { data, meta } / { error } 를 풀어서 data만 돌려준다. */
export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  return (await requestWithMeta<T, unknown>(method, path, options)).data
}

/** 목록 API처럼 meta(next_cursor 등)가 필요할 때 */
export async function requestWithMeta<T, M>(
  method: string,
  path: string,
  options: RequestOptions = {},
  forceMock = false,
): Promise<{ data: T; meta: M }> {
  let raw: RawResponse
  try {
    raw = await send(method, path, options, forceMock)
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: '서버에 연결하지 못했어요. 네트워크 상태를 확인해 주세요.',
      details: {},
    })
  }

  const body = raw.body as { data?: T; meta?: M; error?: ApiErrorBody } | null
  if (raw.status >= 400 || body?.error) {
    throw new ApiError(raw.status, body?.error ?? { code: 'UNKNOWN_ERROR', message: '알 수 없는 오류가 발생했어요.', details: {} })
  }
  return { data: (body?.data ?? null) as T, meta: (body?.meta ?? {}) as M }
}

/** 커서 목록을 끝까지 받는다 (real 모드 백엔드 목록은 기본 20개씩 온다) */
export async function requestAll<T>(path: string, options: Omit<RequestOptions, 'body'> = {}): Promise<T[]> {
  const out: T[] = []
  let cursor: string | null = null
  do {
    const query: Record<string, string> = { ...options.query, limit: '100', ...(cursor ? { cursor } : {}) }
    const res: { data: T[]; meta: { next_cursor?: string | null } } = await requestWithMeta<T[], { next_cursor?: string | null }>('GET', path, { ...options, query })
    out.push(...(res.data ?? []))
    cursor = res.meta.next_cursor ?? null
  } while (cursor)
  return out
}

/**
 * real 모드에서도 목업이 받게 한다. 먼저 그 프로젝트의 실제 데이터를 새로 옮겨 둔다.
 * 실제 데이터(인물·규칙)에 목업만 아는 것(관계 수·AI 후보)을 붙여 보여 줄 때 쓴다.
 */
export function requestMock<T>(method: string, path: string, options: RequestOptions = {}) {
  return requestWithMeta<T, unknown>(method, path, options, true).then((r) => r.data)
}

/** 백엔드에 아직 없는 기능 (real 모드) */
export function notSupported(message = '아직 지원하지 않는 기능이에요. 지금은 Google 로그인만 쓸 수 있어요.'): never {
  throw new ApiError(501, { code: 'NOT_SUPPORTED', message, details: {} })
}
