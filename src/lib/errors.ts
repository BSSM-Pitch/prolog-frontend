import { ApiError } from '../api/client'

export function describeError(e: unknown): string {
  if (e instanceof ApiError) return e.message
  return '문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.'
}

export function errorCode(e: unknown): string | null {
  return e instanceof ApiError ? e.code : null
}

/** 목업에서 소셜 공급자 인가 코드를 흉내 낸다. 실제 연동 시 OAuth 리다이렉트 콜백에서 받은 code로 바꾼다. */
export function mockOAuthCode(provider: string) {
  return `mock_${provider}_${Date.now()}`
}
