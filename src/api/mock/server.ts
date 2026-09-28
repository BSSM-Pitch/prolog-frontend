import type { RawResponse } from '../client'
import type { OAuthProvider, OwnerType, Project, ProjectSort, User, UserRole } from '../types'
import { loadDb, saveDb, type MockDb, type MockProject, type MockUser } from './db'

interface MockRequest {
  method: string
  path: string
  query: Record<string, string>
  headers: Record<string, string>
  body: unknown
}

type Body = Record<string, unknown>
type Handler = (req: MockRequest, db: MockDb, params: Record<string, string>) => RawResponse

const LATENCY_MS = 350
const CODE_TTL_SEC = 300
const ACCESS_TTL_SEC = 3600
const ROLES: UserRole[] = ['writer', 'aspiring_writer', 'reader']
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ok = (status: number, data: unknown, meta: Body = {}): RawResponse => ({ status, body: { data, meta } })
const fail = (status: number, code: string, message: string, details: Body = {}): RawResponse => ({
  status,
  body: { error: { code, message, details } },
})

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const lower = (v: string) => v.toLowerCase()

function toUser(u: MockUser): User {
  return {
    user_id: u.user_id,
    username: u.username,
    email: u.email,
    role: u.role,
    auth_provider: u.auth_provider,
    created_at: u.created_at,
    updated_at: u.updated_at,
  }
}

function randomToken(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`
}

function issueTokens(db: MockDb, userId: string) {
  const access_token = randomToken('at')
  const refresh_token = randomToken('rt')
  db.accessTokens[access_token] = { user_id: userId, expires_at: Date.now() + ACCESS_TTL_SEC * 1000 }
  db.refreshTokens[refresh_token] = { user_id: userId, revoked: false }
  return { access_token, refresh_token, expires_in: ACCESS_TTL_SEC }
}

function newCode() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

function findByLoginId(db: MockDb, loginId: string) {
  const id = lower(loginId)
  return db.users.find((u) => lower(u.username) === id || (u.email !== null && lower(u.email) === id))
}

function nextUserId(db: MockDb) {
  db.seq += 1
  return `user_${db.seq}`
}

function stamp() {
  return new Date().toISOString()
}

/** Authorization 헤더의 액세스 토큰으로 사용자를 찾는다. 실패하면 401 응답을 돌려준다. */
function authenticate(req: MockRequest, db: MockDb): MockUser | RawResponse {
  const token = (req.headers.Authorization ?? '').replace(/^Bearer /, '')
  const record = db.accessTokens[token]
  if (!record || record.expires_at < Date.now()) return fail(401, 'UNAUTHORIZED', '로그인이 필요해요.')
  return db.users.find((u) => u.user_id === record.user_id) ?? fail(404, 'USER_NOT_FOUND', '사용자를 찾을 수 없어요.')
}

const isResponse = (v: MockUser | RawResponse): v is RawResponse => 'status' in v

function toProject(db: MockDb, p: MockProject, userId: string): Project {
  const member = db.projectMembers.find((m) => m.project_id === p.project_id && m.user_id === userId)
  return {
    ...p,
    team_name: db.teams.find((t) => t.team_id === p.team_id)?.name ?? null,
    my_role: member?.role ?? 'viewer',
  }
}

const SORTERS: Record<ProjectSort, (a: MockProject, b: MockProject) => number> = {
  updated_desc: (a, b) => b.updated_at.localeCompare(a.updated_at),
  created_desc: (a, b) => b.created_at.localeCompare(a.created_at),
  title_asc: (a, b) => a.title.localeCompare(b.title, 'ko'),
}

const routes: Array<[string, string, Handler]> = [
  [
    'GET',
    '/users/check-username',
    (req, db) => {
      const username = str(req.query.username)
      if (!username) return fail(400, 'INVALID_INPUT', '아이디를 입력해 주세요.')
      const available = !db.users.some((u) => lower(u.username) === lower(username))
      return ok(200, { username, available })
    },
  ],
  [
    'POST',
    '/auth/email/verification',
    (req, db) => {
      const email = str((req.body as Body)?.email)
      if (!EMAIL_RULE.test(email)) return fail(400, 'INVALID_INPUT', '이메일 형식이 올바르지 않아요.', { field: 'email' })
      if (db.users.some((u) => u.email !== null && lower(u.email) === lower(email))) {
        return fail(409, 'EMAIL_TAKEN', '이미 가입된 이메일이에요.', { field: 'email' })
      }
      const code = newCode()
      db.signupCodes[lower(email)] = { code, expires_at: Date.now() + CODE_TTL_SEC * 1000 }
      console.info(`[mock] 가입 인증 코드 (${email}): ${code}`)
      return ok(202, { email, expires_in: CODE_TTL_SEC })
    },
  ],
  [
    'POST',
    '/auth/signup',
    (req, db) => {
      const b = (req.body ?? {}) as Body
      const username = str(b.username)
      const email = str(b.email)
      const password = typeof b.password === 'string' ? b.password : ''
      const role = b.role as UserRole
      const code = str(b.verification_code)

      if (!username) return fail(400, 'USERNAME_REQUIRED', '아이디를 입력해 주세요.')
      if (!EMAIL_RULE.test(email) || !PASSWORD_RULE.test(password) || !ROLES.includes(role)) {
        return fail(400, 'INVALID_INPUT', '입력한 내용을 다시 확인해 주세요.')
      }
      if (db.users.some((u) => lower(u.username) === lower(username))) {
        return fail(409, 'USERNAME_TAKEN', '이미 사용 중인 아이디예요.', { field: 'username' })
      }
      if (db.users.some((u) => u.email !== null && lower(u.email) === lower(email))) {
        return fail(409, 'EMAIL_TAKEN', '이미 가입된 이메일이에요.', { field: 'email' })
      }
      const pending = db.signupCodes[lower(email)]
      if (!pending) return fail(400, 'VERIFICATION_CODE_INVALID', '인증 코드를 먼저 요청해 주세요.')
      if (pending.expires_at < Date.now()) return fail(410, 'VERIFICATION_CODE_EXPIRED', '인증 코드가 만료됐어요.')
      if (pending.code !== code) return fail(400, 'VERIFICATION_CODE_INVALID', '인증 코드가 일치하지 않아요.')

      delete db.signupCodes[lower(email)]
      const t = stamp()
      const user: MockUser = {
        user_id: nextUserId(db),
        username,
        name: null,
        email,
        password,
        role,
        auth_provider: 'local',
        provider_user_id: null,
        created_at: t,
        updated_at: t,
      }
      db.users.push(user)
      return ok(201, { user: toUser(user), tokens: issueTokens(db, user.user_id) })
    },
  ],
  [
    'POST',
    '/auth/login',
    (req, db) => {
      const b = (req.body ?? {}) as Body
      const user = findByLoginId(db, str(b.login_id))
      if (!user || user.password === null || user.password !== b.password) {
        return fail(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 올바르지 않습니다.')
      }
      return ok(200, { user: toUser(user), tokens: issueTokens(db, user.user_id) })
    },
  ],
  [
    'POST',
    '/auth/oauth/:provider',
    (req, db, params) => {
      const provider = params.provider as OAuthProvider
      if (provider !== 'google' && provider !== 'naver') return fail(400, 'INVALID_INPUT', '지원하지 않는 로그인 방식이에요.')
      const b = (req.body ?? {}) as Body
      if (!str(b.oauth_code)) return fail(502, 'OAUTH_PROVIDER_ERROR', '소셜 로그인 공급자 응답을 받지 못했어요.')

      // 목업: 공급자 쪽 사용자 ID를 공급자별 고정값으로 흉내 낸다. Google은 가입된 데모 계정이 있다.
      const providerUserId = `${provider}-sub-demo`
      const existing = db.users.find((u) => u.auth_provider === provider && u.provider_user_id === providerUserId)
      if (existing) return ok(200, { user: toUser(existing), tokens: issueTokens(db, existing.user_id) }, { is_new_user: false })

      const username = str(b.username)
      if (!username) return fail(400, 'USERNAME_REQUIRED', '처음 연결한 계정이에요. 회원가입에서 아이디를 정해 주세요.')
      if (db.users.some((u) => lower(u.username) === lower(username))) {
        return fail(409, 'USERNAME_TAKEN', '이미 사용 중인 아이디예요.', { field: 'username' })
      }
      const role = ROLES.includes(b.role as UserRole) ? (b.role as UserRole) : 'writer'
      const t = stamp()
      const user: MockUser = {
        user_id: nextUserId(db),
        username,
        name: null,
        email: `${username}@${provider === 'google' ? 'gmail.com' : 'naver.com'}`,
        password: null,
        role,
        auth_provider: provider,
        provider_user_id: providerUserId,
        created_at: t,
        updated_at: t,
      }
      db.users.push(user)
      return ok(201, { user: toUser(user), tokens: issueTokens(db, user.user_id) }, { is_new_user: true })
    },
  ],
  [
    'POST',
    '/auth/token/refresh',
    (req, db) => {
      const token = str((req.body as Body)?.refresh_token)
      const record = db.refreshTokens[token]
      if (!record || record.revoked) return fail(401, 'REFRESH_TOKEN_INVALID', '다시 로그인해 주세요.')
      const access_token = randomToken('at')
      db.accessTokens[access_token] = { user_id: record.user_id, expires_at: Date.now() + ACCESS_TTL_SEC * 1000 }
      return ok(200, { access_token, refresh_token: token, expires_in: ACCESS_TTL_SEC })
    },
  ],
  [
    'POST',
    '/auth/logout',
    (req, db) => {
      const token = str((req.body as Body)?.refresh_token)
      if (db.refreshTokens[token]) db.refreshTokens[token].revoked = true
      return { status: 204, body: null }
    },
  ],
  [
    'GET',
    '/users/me',
    (req, db) => {
      const user = authenticate(req, db)
      return isResponse(user) ? user : ok(200, toUser(user))
    },
  ],
  [
    'GET',
    '/projects',
    (req, db) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user

      const ownerType = req.query.owner_type as OwnerType | undefined
      if (ownerType && ownerType !== 'personal' && ownerType !== 'team') {
        return fail(400, 'INVALID_INPUT', 'owner_type은 personal 또는 team이어야 해요.')
      }
      const sort = (req.query.sort ?? 'updated_desc') as ProjectSort
      if (!SORTERS[sort]) return fail(400, 'INVALID_INPUT', '지원하지 않는 정렬이에요.')
      const limit = Math.min(Math.max(Number(req.query.limit ?? 20) || 20, 1), 100)
      const offset = req.query.cursor ? Number(atob(req.query.cursor)) || 0 : 0

      const mine = db.projects.filter((p) => db.projectMembers.some((m) => m.project_id === p.project_id && m.user_id === user.user_id))
      const filtered = mine.filter((p) => !ownerType || p.owner_type === ownerType).sort(SORTERS[sort])
      const page = filtered.slice(offset, offset + limit)
      const next = offset + limit < filtered.length ? btoa(String(offset + limit)) : null

      return ok(200, page.map((p) => toProject(db, p, user.user_id)), {
        next_cursor: next,
        counts: {
          all: mine.length,
          personal: mine.filter((p) => p.owner_type === 'personal').length,
          team: mine.filter((p) => p.owner_type === 'team').length,
        },
      })
    },
  ],
  [
    'POST',
    '/auth/username/find',
    (req, db) => {
      const b = (req.body ?? {}) as Body
      const name = str(b.name)
      const email = lower(str(b.email))
      const user = db.users.find((u) => u.email !== null && lower(u.email) === email && (u.name === null || u.name === name))
      if (!user) return fail(404, 'USER_NOT_FOUND', '입력한 이름과 이메일로 가입된 계정이 없어요.')
      if (user.auth_provider !== 'local') {
        return fail(400, 'SOCIAL_ONLY_ACCOUNT', '소셜 계정으로 가입한 이메일이에요.', { provider: user.auth_provider })
      }
      return ok(200, { username: user.username })
    },
  ],
  [
    'POST',
    '/auth/password/reset-request',
    (req, db) => {
      const loginId = str((req.body as Body)?.login_id)
      if (!loginId) return fail(400, 'INVALID_INPUT', '아이디 또는 이메일을 입력해 주세요.')
      const user = findByLoginId(db, loginId)
      if (user && user.auth_provider !== 'local') {
        return fail(400, 'SOCIAL_ONLY_ACCOUNT', '소셜 계정은 비밀번호를 재설정할 수 없어요.', { provider: user.auth_provider })
      }
      // 계정 존재 여부를 노출하지 않도록 없는 계정도 202로 응답한다.
      if (user) {
        const code = newCode()
        db.resetCodes[user.user_id] = { code, expires_at: Date.now() + CODE_TTL_SEC * 1000 }
        console.info(`[mock] 비밀번호 재설정 코드 (${user.username}): ${code}`)
      }
      return ok(202, { expires_in: CODE_TTL_SEC })
    },
  ],
  [
    'POST',
    '/auth/password/reset',
    (req, db) => {
      const b = (req.body ?? {}) as Body
      const user = findByLoginId(db, str(b.login_id))
      const pending = user ? db.resetCodes[user.user_id] : undefined
      if (!user || !pending || pending.code !== str(b.code)) {
        return fail(400, 'VERIFICATION_CODE_INVALID', '인증 코드가 일치하지 않아요.', { field: 'code' })
      }
      if (pending.expires_at < Date.now()) return fail(410, 'VERIFICATION_CODE_EXPIRED', '인증 코드가 만료됐어요.', { field: 'code' })
      const next = typeof b.new_password === 'string' ? b.new_password : ''
      if (!PASSWORD_RULE.test(next)) return fail(400, 'WEAK_PASSWORD', '영문과 숫자를 포함해 8자 이상으로 정해 주세요.')
      user.password = next
      user.updated_at = stamp()
      delete db.resetCodes[user.user_id]
      Object.values(db.refreshTokens).forEach((r) => {
        if (r.user_id === user.user_id) r.revoked = true
      })
      return { status: 204, body: null }
    },
  ],
]

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
  for (const [method, pattern, handler] of routes) {
    if (method !== req.method) continue
    const params = match(pattern, req.path)
    if (!params) continue
    const db = loadDb()
    const res = handler(req, db, params)
    saveDb(db)
    return res
  }
  return fail(404, 'NOT_FOUND', `목업에 없는 API예요: ${req.method} ${req.path}`)
}
