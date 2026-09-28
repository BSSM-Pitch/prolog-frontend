import type { EmailIntegration, Notification, NotificationSetting } from '../../types'
import type { MockDb, MockNotification, NotificationType } from '../db'
import { authenticate, fail, isResponse, nextId, noContent, ok, paginate, stamp, str, type Body, type Route } from '../http'
import { NOTIFICATION_TYPES, settingOf } from '../notify'
import { settleInvitations } from './members'

/** 초대 알림에는 지금 초대 상태와 만료 시각을 붙여 "참가" 버튼을 정한다 (명세 미정의) */
function toNotification(db: MockDb, n: MockNotification): Notification {
  let ref: Notification['related_ref'] = n.related_ref
  if (n.related_ref && (n.related_ref.type === 'team_invitation' || n.related_ref.type === 'project_invitation')) {
    const rows = n.related_ref.type === 'team_invitation' ? db.teamInvitations : db.projectInvitations
    settleInvitations(rows)
    const inv = rows.find((i) => i.invitation_id === n.related_ref!.id)
    ref = { ...n.related_ref, status: inv?.status ?? 'revoked', expires_at: inv?.expires_at ?? null }
  }
  return { notification_id: n.notification_id, user_id: n.user_id, type: n.type, title: n.title, body: n.body, related_ref: ref, channels_sent: n.channels_sent, read_at: n.read_at, created_at: n.created_at }
}

const mine = (db: MockDb, userId: string) => db.notifications.filter((n) => n.user_id === userId && n.channels_sent.includes('in_app'))

// NOTI 명세
export const notificationRoutes: Route[] = [
  [
    // 4.1 알림 목록 — unread_only, type 필터
    'GET',
    '/notifications',
    (req, db) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const all = mine(db, user.user_id).sort((a, b) => b.created_at.localeCompare(a.created_at))
      let rows = all
      if (req.query.unread_only === 'true') rows = rows.filter((n) => !n.read_at)
      if (req.query.type) rows = rows.filter((n) => n.type === req.query.type)
      const { page, next_cursor } = paginate(req, rows)
      return ok(200, page.map((n) => toNotification(db, n)), { next_cursor, unread_count: all.filter((n) => !n.read_at).length })
    },
  ],
  [
    // 4.4 전체 읽음 처리
    'PATCH',
    '/notifications/read-all',
    (req, db) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const t = stamp()
      const unread = mine(db, user.user_id).filter((n) => !n.read_at)
      for (const n of unread) n.read_at = t
      return ok(200, { updated_count: unread.length })
    },
  ],
  [
    'GET',
    '/notifications/:notificationId',
    (req, db, { notificationId }) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const n = mine(db, user.user_id).find((x) => x.notification_id === notificationId)
      return n ? ok(200, toNotification(db, n)) : fail(404, 'NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없어요.')
    },
  ],
  [
    // 4.3 읽음 처리 { read: true } — false면 안 읽음으로 되돌린다 (명세 미정의)
    'PATCH',
    '/notifications/:notificationId',
    (req, db, { notificationId }) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const n = mine(db, user.user_id).find((x) => x.notification_id === notificationId)
      if (!n) return fail(404, 'NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없어요.')
      const read = (req.body as Body)?.read
      if (typeof read !== 'boolean') return fail(400, 'INVALID_INPUT', 'read 값이 필요해요.', { field: 'read' })
      n.read_at = read ? (n.read_at ?? stamp()) : null
      return ok(200, toNotification(db, n))
    },
  ],
  [
    'DELETE',
    '/notifications/:notificationId',
    (req, db, { notificationId }) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const n = mine(db, user.user_id).find((x) => x.notification_id === notificationId)
      if (!n) return fail(404, 'NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없어요.')
      db.notifications = db.notifications.filter((x) => x !== n)
      return noContent()
    },
  ],
  [
    // 4.6 알림 설정 조회
    'GET',
    '/users/me/notification-settings',
    (req, db) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const rows: NotificationSetting[] = NOTIFICATION_TYPES.map((type) => ({ type, ...settingOf(db, user.user_id, type) }))
      return ok(200, rows)
    },
  ],
  [
    // 4.7 알림 설정 변경 — 한 유형씩
    'PATCH',
    '/users/me/notification-settings',
    (req, db) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const b = (req.body ?? {}) as Body
      const type = str(b.type) as NotificationType
      if (!NOTIFICATION_TYPES.includes(type)) return fail(400, 'INVALID_INPUT', '알림 유형을 확인해 주세요.', { field: 'type' })
      const next = { ...settingOf(db, user.user_id, type) }
      if (typeof b.in_app_enabled === 'boolean') next.in_app_enabled = b.in_app_enabled
      if (typeof b.email_enabled === 'boolean') next.email_enabled = b.email_enabled
      db.notificationSettings[user.user_id] = { ...db.notificationSettings[user.user_id], [type]: next }
      return ok(200, { type, ...next })
    },
  ],
  [
    'GET',
    '/users/me/email-integrations',
    (req, db) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const rows: EmailIntegration[] = db.emailIntegrations
        .filter((e) => e.user_id === user.user_id)
        .map((e) => ({ integration_id: e.integration_id, provider: e.provider, email_address: e.email_address, connected_at: e.connected_at }))
      return ok(200, rows)
    },
  ],
  [
    // 4.9 이메일 연동 (OAuth). 목업은 oauth_code만 확인하고 아이디로 주소를 만든다
    'POST',
    '/users/me/email-integrations',
    (req, db) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const b = (req.body ?? {}) as Body
      const provider = str(b.provider)
      if (provider !== 'gmail' && provider !== 'naver') return fail(400, 'INVALID_INPUT', '연동할 메일 서비스를 골라 주세요.', { field: 'provider' })
      if (!str(b.oauth_code)) return fail(400, 'INVALID_INPUT', '인증 코드가 필요해요.', { field: 'oauth_code' })
      if (/fail/i.test(str(b.oauth_code))) return fail(502, 'OAUTH_PROVIDER_ERROR', `${provider === 'gmail' ? 'Google' : '네이버'} 인증 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.`)
      if (db.emailIntegrations.some((e) => e.user_id === user.user_id && e.provider === provider)) {
        return fail(409, 'EMAIL_ALREADY_CONNECTED', '이미 연동된 계정이 있어요. 다른 계정으로 바꾸려면 먼저 연동을 해제해 주세요.')
      }
      const e = {
        integration_id: nextId(db, 'eint'),
        user_id: user.user_id,
        provider: provider as 'gmail' | 'naver',
        email_address: `${user.username.replace(/[^a-z0-9._]/gi, '')}@${provider === 'gmail' ? 'gmail.com' : 'naver.com'}`,
        connected_at: stamp(),
      }
      db.emailIntegrations.push(e)
      return ok(201, { integration_id: e.integration_id, provider: e.provider, email_address: e.email_address, connected_at: e.connected_at })
    },
  ],
  [
    // 4.10 이메일 연동 해제
    'DELETE',
    '/users/me/email-integrations/:integrationId',
    (req, db, { integrationId }) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const e = db.emailIntegrations.find((x) => x.integration_id === integrationId && x.user_id === user.user_id)
      if (!e) return fail(404, 'EMAIL_INTEGRATION_NOT_FOUND', '연동된 계정을 찾을 수 없어요.')
      db.emailIntegrations = db.emailIntegrations.filter((x) => x !== e)
      return noContent()
    },
  ],
]
