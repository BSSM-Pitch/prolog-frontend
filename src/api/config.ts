// API 모드. real이면 백엔드에 구현된 API는 실제 서버로, 나머지는 목업으로 보낸다(혼합 모드).
export const IS_REAL = import.meta.env.VITE_API_MODE === 'real'
/**
 * AI 기능(NLCD·REX 추출·AIQ·SCDS·SSM)도 백엔드로 보낼지. 백엔드에 OpenRouter 키가 없으면
 * USE_FAKE_LLM 빈 응답만 오므로, 시연 때는 VITE_AI_MODE=mock으로 AI만 목업에 맡길 수 있다.
 */
export const AI_REAL = IS_REAL && import.meta.env.VITE_AI_MODE !== 'mock'
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/v1'

// 백엔드 ID는 UUID다. 목업이 만든 AI 초안·규칙 후보(draft_301, rule_302 등)는 목업이 받는다
const ID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const P = '^\\/projects\\/[^/]+'
const r = (source: string) => new RegExp(source.replaceAll('{P}', P).replaceAll('{ID}', ID))

/**
 * prolog-backend(06b8928)에 있는 API. 경로는 /v1을 뺀 형태.
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
  ['GET', /^\/projects\/[^/]+\/manuscripts\/[^/]+\/versions$/],
  // ASS 수동 경로
  ['GET|POST', r('{P}\\/character-drafts$')],
  ['GET|PATCH', r('{P}\\/character-drafts\\/{ID}$')],
  ['POST', r('{P}\\/character-drafts\\/{ID}\\/(confirm|discard|items)$')],
  ['GET', r('{P}\\/character-drafts\\/{ID}\\/edit-history$')],
  ['PATCH|DELETE', r('{P}\\/character-drafts\\/{ID}\\/items\\/[^/]+$')],
  ['GET', r('{P}\\/characters$')],
  ['GET|PATCH|DELETE', r('{P}\\/characters\\/{ID}$')],
  ['GET', r('{P}\\/characters\\/{ID}\\/edit-history$')],
  // REX 직접 입력
  ['GET|POST', r('{P}\\/world-rules$')],
  ['PATCH|DELETE', r('{P}\\/world-rules\\/{ID}$')],
  // FTS (사건 연결 제외 전부)
  ['GET|POST', /^\/projects\/[^/]+\/foreshadowings$/],
  ['GET', /^\/projects\/[^/]+\/foreshadowings\/unresolved(\/advisories)?$/],
  ['GET|PATCH|DELETE', /^\/projects\/[^/]+\/foreshadowings\/[^/]+$/],
  ['POST', /^\/projects\/[^/]+\/foreshadowings\/[^/]+\/(linked-chapters|links)$/],
  ['DELETE', /^\/projects\/[^/]+\/foreshadowings\/[^/]+\/(linked-chapters\/[^/]+|links\/character\/[^/]+)$/],
  ['PUT|DELETE', /^\/projects\/[^/]+\/foreshadowings\/[^/]+\/payoff$/],
  ['GET', /^\/projects\/[^/]+\/foreshadowing-timeline$/],
  ['GET', /^\/projects\/[^/]+\/chapters\/[^/]+\/foreshadowings$/],
  // TEAM
  ['GET|POST', /^\/teams$/],
  ['GET|PATCH|DELETE', /^\/teams\/[^/]+$/],
  ['GET', /^\/teams\/[^/]+\/(members|projects)$/],
  ['PATCH|DELETE', /^\/teams\/[^/]+\/members\/[^/]+$/],
  ['GET|POST', /^\/teams\/[^/]+\/invitations$/],
  ['DELETE', /^\/teams\/[^/]+\/invitations\/[^/]+$/],
  ['POST', /^\/teams\/[^/]+\/invitations\/[^/]+\/accept$/],
  // NOTI (이메일 연동은 백엔드가 만들지 않기로 했다)
  ['GET|PATCH', /^\/users\/me\/notification-settings$/],
  ['GET', /^\/notifications$/],
  ['PATCH', /^\/notifications\/read-all$/],
  ['GET|PATCH|DELETE', /^\/notifications\/[^/]+$/],
]

/** prolog-backend(06b8928) AI API — AI_REAL일 때만 백엔드로 보낸다 */
const AI_ROUTES: Array<[string, RegExp]> = [
  // NLCD AI 인물 추출
  ['GET|POST', r('{P}\\/nl-extractions$')],
  ['GET', r('{P}\\/nl-extractions\\/{ID}$')],
  ['POST', r('{P}\\/nl-extractions\\/{ID}\\/(retry|forward)$')],
  // REX AI 규칙 추출
  ['POST', r('{P}\\/manuscripts\\/{ID}\\/rule-extractions$')],
  ['GET', r('{P}\\/manuscripts\\/{ID}\\/rule-extractions\\/{ID}$')],
  ['POST', r('{P}\\/manuscripts\\/{ID}\\/rule-extractions\\/{ID}\\/(retry|confirm)$')],
  // AIQ 원고 질문
  ['GET|POST', r('{P}\\/manuscripts\\/{ID}\\/qa-threads$')],
  ['GET|DELETE', r('{P}\\/manuscripts\\/{ID}\\/qa-threads\\/{ID}$')],
  ['POST', r('{P}\\/manuscripts\\/{ID}\\/qa-threads\\/{ID}\\/messages$')],
  ['GET', r('{P}\\/manuscripts\\/{ID}\\/qa-threads\\/{ID}\\/messages\\/{ID}$')],
  ['POST', r('{P}\\/manuscripts\\/{ID}\\/qa-threads\\/{ID}\\/messages\\/{ID}\\/retry$')],
  // SCDS 설정 충돌 (사건 저장 → 검사)
  ['POST', r('{P}\\/chapters\\/{ID}\\/events$')],
  ['GET', r('{P}\\/conflict-checks\\/{ID}$')],
  ['POST', r('{P}\\/conflict-checks\\/{ID}\\/retry$')],
  ['GET', r('{P}\\/conflicts(\\/history)?$')],
  ['GET|PATCH', r('{P}\\/conflicts\\/{ID}$')],
  // SSM 스토리 지도
  ['POST', r('{P}\\/manuscripts\\/{ID}\\/structure-analyses$')],
  ['GET', r('{P}\\/manuscripts\\/{ID}\\/structure-analyses\\/{ID}$')],
  ['POST', r('{P}\\/manuscripts\\/{ID}\\/structure-analyses\\/{ID}\\/retry$')],
  ['GET', r('{P}\\/manuscripts\\/{ID}\\/structure-map$')],
  ['GET|PATCH', r('{P}\\/manuscripts\\/{ID}\\/structure-map\\/nodes\\/{ID}$')],
]

const ROUTES = AI_REAL ? [...BACKEND_ROUTES, ...AI_ROUTES] : BACKEND_ROUTES

export function servedByBackend(method: string, path: string) {
  return IS_REAL && ROUTES.some(([methods, re]) => methods.split('|').includes(method) && re.test(path))
}
