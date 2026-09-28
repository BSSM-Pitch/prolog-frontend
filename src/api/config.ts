// API 모드. real이면 백엔드에 구현된 API는 실제 서버로, 나머지는 목업으로 보낸다(혼합 모드).
export const IS_REAL = import.meta.env.VITE_API_MODE === 'real'
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/v1'

/**
 * prolog-backend(Phase 1)에 있는 API. 경로는 /v1을 뺀 형태.
 * 여기에 없는 요청은 real 모드에서도 목업이 받는다.
 */
const BACKEND_ROUTES: Array<[string, RegExp]> = [
  ['POST', /^\/auth\/(oauth\/google|signup|token\/refresh|logout)$/],
  ['GET|PATCH', /^\/users\/me$/],
  ['GET', /^\/users\/check-username$/],
  // PRJ
  ['GET|POST', /^\/projects$/],
  ['GET|PATCH|DELETE', /^\/projects\/[^/]+$/],
  ['GET', /^\/projects\/[^/]+\/members$/],
  ['PATCH|DELETE', /^\/projects\/[^/]+\/members\/[^/]+$/],
  ['POST', /^\/projects\/[^/]+\/invitations$/],
  ['DELETE', /^\/projects\/[^/]+\/invitations\/[^/]+$/],
  ['POST', /^\/projects\/[^/]+\/invitations\/[^/]+\/accept$/],
  // MSU (챕터는 프로젝트 직속)
  ['GET|POST', /^\/projects\/[^/]+\/manuscripts$/],
  ['GET|PATCH|DELETE', /^\/projects\/[^/]+\/manuscripts\/[^/]+$/],
  ['POST', /^\/projects\/[^/]+\/manuscripts\/[^/]+\/file(\/complete)?$/],
  ['GET|POST', /^\/projects\/[^/]+\/chapters$/],
  ['GET|PATCH|DELETE', /^\/projects\/[^/]+\/chapters\/[^/]+$/],
  // TEAM
  ['GET|POST', /^\/teams$/],
  ['GET|PATCH|DELETE', /^\/teams\/[^/]+$/],
  ['GET', /^\/teams\/[^/]+\/(members|projects)$/],
  ['PATCH|DELETE', /^\/teams\/[^/]+\/members\/[^/]+$/],
  ['GET|POST', /^\/teams\/[^/]+\/invitations$/],
  ['DELETE', /^\/teams\/[^/]+\/invitations\/[^/]+$/],
  ['POST', /^\/teams\/[^/]+\/invitations\/[^/]+\/accept$/],
  // NOTI (인앱 알림만 — 설정·이메일 연동은 아직 없다)
  ['GET', /^\/notifications$/],
  ['PATCH', /^\/notifications\/read-all$/],
  ['GET|PATCH|DELETE', /^\/notifications\/[^/]+$/],
]

export function servedByBackend(method: string, path: string) {
  return IS_REAL && BACKEND_ROUTES.some(([methods, re]) => methods.split('|').includes(method) && re.test(path))
}
