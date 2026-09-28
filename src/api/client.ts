import type { ApiErrorBody } from './types'
import { handleMockRequest } from './mock/server'

// VITE_API_MODE=real 이면 VITE_API_BASE_URL의 실제 서버로, 아니면 브라우저 안의 목업 서버로 보낸다.
const useMock = import.meta.env.VITE_API_MODE !== 'real'
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'https://api.storyforge.io/v1'

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

async function send(method: string, path: string, options: RequestOptions): Promise<RawResponse> {
  const query = options.query ? `?${new URLSearchParams(options.query)}` : ''
  const headers: Record<string, string> = {}
  const isForm = options.body instanceof FormData
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`

  if (useMock) {
    return handleMockRequest({ method, path, query: options.query ?? {}, headers, body: options.body })
  }

  const res = await fetch(`${baseUrl}${path}${query}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
  })
  const body = res.status === 204 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
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
): Promise<{ data: T; meta: M }> {
  let raw: RawResponse
  try {
    raw = await send(method, path, options)
  } catch {
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
