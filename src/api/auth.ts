import { notSupported, request, requestWithMeta } from './client'
import { IS_REAL } from './config'
import type { AuthResult, AuthTokens, OAuthProvider, User, UserRole } from './types'

// AUTH 명세 3장 엔드포인트. "(명세 미정의)" 표시는 Figma 화면 때문에 추가한 것으로, 백엔드와 합의가 필요하다.
// prolog-backend는 Google·네이버 소셜 로그인과 아이디(또는 이메일)·비밀번호 가입·로그인을 지원한다.
// 가입 전 이메일 인증, 아이디 찾기, 비밀번호 재설정은 아직 없어서 real 모드에서는 누르면 안내한다.

export function checkUsername(username: string) {
  return request<{ username: string; available: boolean }>('GET', '/users/check-username', { query: { username } })
}

/** (명세 미정의) 09 · 계정 인증 — 가입 전 이메일 인증 코드 발송. real 모드는 인증 없이 바로 가입한다 */
export function sendSignupCode(email: string) {
  if (IS_REAL) notSupported()
  return request<{ email: string; expires_in: number }>('POST', '/auth/email/verification', {
    body: { email, purpose: 'signup' },
  })
}

export interface SignupInput {
  username: string
  email: string
  password: string
  role: UserRole
  /** (명세 미정의) 이메일 인증 코드 — 목업만 받는다 */
  verification_code?: string
}

/** 일반 가입 — 아이디 + 이메일 + 비밀번호(영문·숫자 포함 8자 이상) + 사용자 유형. 성공하면 바로 로그인된다 */
export function signup(input: SignupInput) {
  const { verification_code, ...body } = input
  return request<AuthResult>('POST', '/auth/signup', { body: IS_REAL ? body : { ...body, verification_code } })
}

/** login_id는 아이디 또는 이메일. 소셜로 가입한 계정은 이 경로로 로그인할 수 없다(INVALID_CREDENTIALS) */
export function login(loginId: string, password: string) {
  return request<AuthResult>('POST', '/auth/login', { body: { login_id: loginId, password } })
}

/** AUTH v0.2 — 가입된 계정이면 로그인, 처음이면 가입 티켓(10분)을 받아 아이디·유형을 정한 뒤 가입을 마친다 */
export type OAuthResult = { kind: 'session'; result: AuthResult } | { kind: 'signup'; signup_ticket: string; email: string | null }

/** 네이버는 인가 요청 때 보낸 state를 토큰 교환에 그대로 넘긴다 */
export async function oauthLogin(provider: OAuthProvider, oauthCode: string, state?: string | null): Promise<OAuthResult> {
  const res = await requestWithMeta<AuthResult & { signup_ticket?: string; email?: string | null }, { is_new_user?: boolean }>('POST', `/auth/oauth/${provider}`, {
    body: provider === 'naver' ? { oauth_code: oauthCode, state: state ?? null } : { oauth_code: oauthCode },
  })
  if (res.meta.is_new_user && res.data.signup_ticket) return { kind: 'signup', signup_ticket: res.data.signup_ticket, email: res.data.email ?? null }
  return { kind: 'session', result: { user: res.data.user, tokens: res.data.tokens } }
}

/** 가입 완료 — 가입 티켓 + 아이디 + 사용자 유형 */
export function completeSocialSignup(signupTicket: string, username: string, role: UserRole) {
  return request<AuthResult>('POST', '/auth/signup', { body: { signup_ticket: signupTicket, username, role } })
}

const stateKey = (provider: OAuthProvider) => `prolog.${provider}-oauth-state`

function newState(provider: OAuthProvider) {
  const state = crypto.randomUUID()
  sessionStorage.setItem(stateKey(provider), state)
  return state
}

/**
 * real 모드: Google 인가 화면 주소. 돌아오면 /auth/callback이 code를 받는다. 클라이언트 ID가 없으면 null.
 * 개발 서버에서 VITE_DEV_GOOGLE_LOGIN("이름|메일")이 있으면 Google 대신 그 계정으로 바로 콜백한다 —
 * 백엔드 검증 서버(scripts.verify.serve)의 fake Google이 "seed-이름|메일" 코드를 받는다
 */
export function googleAuthorizeUrl(): string | null {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const devLogin = import.meta.env.DEV ? import.meta.env.VITE_DEV_GOOGLE_LOGIN : undefined
  if (!clientId && !devLogin) return null
  const state = newState('google')
  if (!clientId) return `/auth/callback?${new URLSearchParams({ code: `seed-${devLogin!}`, state })}`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: import.meta.env.VITE_GOOGLE_REDIRECT_URI ?? `${window.location.origin}/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/** real 모드: 네이버 인가 화면 주소. 돌아오면 /auth/callback/naver가 code·state를 받는다. 클라이언트 ID가 없으면 null */
export function naverAuthorizeUrl(): string | null {
  const clientId = import.meta.env.VITE_NAVER_CLIENT_ID
  if (!clientId) return null
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: import.meta.env.VITE_NAVER_REDIRECT_URI ?? `${window.location.origin}/auth/callback/naver`,
    state: newState('naver'),
  })
  return `https://nid.naver.com/oauth2.0/authorize?${params}`
}

/** 콜백의 state가 우리가 보낸 값인지 (CSRF 방지). 다음 로그인 때 새 값으로 덮인다 */
export function checkOAuthState(provider: OAuthProvider, state: string | null) {
  return Boolean(state) && state === sessionStorage.getItem(stateKey(provider))
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
  if (IS_REAL) notSupported()
  return request<{ username: string }>('POST', '/auth/username/find', { body: { name, email } })
}

/** 4.9 비밀번호 재설정 요청 — Figma는 아이디 또는 이메일로 요청한다. */
export function requestPasswordReset(loginId: string) {
  if (IS_REAL) notSupported()
  return request<{ expires_in: number }>('POST', '/auth/password/reset-request', { body: { login_id: loginId } })
}

/** 4.10 비밀번호 재설정 확정 */
export function resetPassword(input: { login_id: string; code: string; new_password: string }) {
  if (IS_REAL) notSupported()
  return request<null>('POST', '/auth/password/reset', { body: input })
}
