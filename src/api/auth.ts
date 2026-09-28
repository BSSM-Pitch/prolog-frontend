import { request } from './client'
import type { AuthResult, AuthTokens, OAuthProvider, User, UserRole } from './types'

// AUTH 명세 3장 엔드포인트. "(명세 미정의)" 표시는 Figma 화면 때문에 추가한 것으로, 백엔드와 합의가 필요하다.

export function checkUsername(username: string) {
  return request<{ username: string; available: boolean }>('GET', '/users/check-username', { query: { username } })
}

/** (명세 미정의) 09 · 계정 인증 — 가입 전 이메일 인증 코드 발송 */
export function sendSignupCode(email: string) {
  return request<{ email: string; expires_in: number }>('POST', '/auth/email/verification', {
    body: { email, purpose: 'signup' },
  })
}

export interface SignupInput {
  username: string
  email: string
  password: string
  role: UserRole
  /** (명세 미정의) 이메일 인증 코드 */
  verification_code: string
}

export function signup(input: SignupInput) {
  return request<AuthResult>('POST', '/auth/signup', { body: input })
}

/** 명세는 username만 받지만 Figma는 "아이디 또는 이메일"이라 login_id로 받는다. */
export function login(loginId: string, password: string) {
  return request<AuthResult>('POST', '/auth/login', { body: { login_id: loginId, password } })
}

export function oauthLogin(provider: OAuthProvider, input: { oauth_code: string; username?: string; role?: UserRole }) {
  return request<AuthResult>('POST', `/auth/oauth/${provider}`, { body: input })
}

export function refreshToken(refresh_token: string) {
  return request<AuthTokens>('POST', '/auth/token/refresh', { body: { refresh_token } })
}

export function logout(refresh_token: string) {
  return request<null>('POST', '/auth/logout', { body: { refresh_token } })
}

export function getMe(accessToken: string) {
  return request<User>('GET', '/users/me', { accessToken })
}

/** (명세 미정의) 10 · 아이디 찾기 */
export function findUsername(name: string, email: string) {
  return request<{ username: string }>('POST', '/auth/username/find', { body: { name, email } })
}

/** 4.9 비밀번호 재설정 요청 — Figma는 아이디 또는 이메일로 요청한다. */
export function requestPasswordReset(loginId: string) {
  return request<{ expires_in: number }>('POST', '/auth/password/reset-request', { body: { login_id: loginId } })
}

/** 4.10 비밀번호 재설정 확정 */
export function resetPassword(input: { login_id: string; code: string; new_password: string }) {
  return request<null>('POST', '/auth/password/reset', { body: input })
}
