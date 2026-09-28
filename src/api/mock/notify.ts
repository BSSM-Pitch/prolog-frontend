import type { MockDb, MockNotification, NotificationType } from './db'
import { nextId, stamp } from './http'

export const NOTIFICATION_TYPES: NotificationType[] = ['team_invite', 'project_invite', 'team_joined', 'mention', 'system']

/** NOTI 2.2 — 바꾼 적 없으면 모두 켜짐 */
export function settingOf(db: MockDb, userId: string, type: NotificationType) {
  return { in_app_enabled: true, email_enabled: true, ...db.notificationSettings[userId]?.[type] }
}

/**
 * NOTI 5장 1~3단계 — PRJ·TEAM 이벤트가 생기면 내부적으로 알림을 만든다 (공개 생성 API 없음).
 * 이메일은 연동 계정이 있고 설정이 켜져 있을 때만 "보낸 것"으로 기록한다.
 */
export function notify(db: MockDb, userId: string, type: NotificationType, title: string, body: string, related_ref: MockNotification['related_ref'] = null) {
  const s = settingOf(db, userId, type)
  const channels: MockNotification['channels_sent'] = []
  if (s.in_app_enabled) channels.push('in_app')
  if (s.email_enabled && db.emailIntegrations.some((e) => e.user_id === userId)) channels.push('email')
  if (channels.length === 0) return
  db.notifications.unshift({ notification_id: nextId(db, 'noti'), user_id: userId, type, title, body, related_ref, channels_sent: channels, read_at: null, created_at: stamp() })
  if (channels.includes('email')) console.info(`[mock] 이메일 알림 → ${userId}: ${body}`)
}

export const displayName = (db: MockDb, userId: string) => {
  const u = db.users.find((x) => x.user_id === userId)
  return u?.name ?? u?.username ?? '누군가'
}
