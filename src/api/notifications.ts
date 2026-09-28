import { request, requestWithMeta } from './client'
import type { EmailIntegration, Notification, NotificationSetting, NotificationType } from './types'

// NOTI 명세

export interface NotificationListMeta {
  next_cursor: string | null
  unread_count: number
}

/** 4.1 알림 목록 */
export async function listNotifications(accessToken: string, params: { unread_only?: boolean; type?: NotificationType | ''; cursor?: string | null; limit?: number } = {}) {
  const query: Record<string, string> = { limit: String(params.limit ?? 5) }
  if (params.unread_only) query.unread_only = 'true'
  if (params.type) query.type = params.type
  if (params.cursor) query.cursor = params.cursor
  const res = await requestWithMeta<Notification[], NotificationListMeta>('GET', '/notifications', { accessToken, query })
  // 백엔드는 body가 null일 수 있다
  return { ...res, data: res.data.map((n) => ({ ...n, body: n.body ?? n.title })) }
}

/** 4.3 읽음 처리 */
export function markRead(accessToken: string, notificationId: string, read = true) {
  return request<Notification>('PATCH', `/notifications/${notificationId}`, { body: { read }, accessToken })
}

/** 4.4 전체 읽음 처리 */
export function markAllRead(accessToken: string) {
  return request<{ updated_count: number }>('PATCH', '/notifications/read-all', { accessToken })
}

/** 4.5 알림 삭제 */
export function deleteNotification(accessToken: string, notificationId: string) {
  return request<null>('DELETE', `/notifications/${notificationId}`, { accessToken })
}

/** 4.6 알림 설정 */
export function getSettings(accessToken: string) {
  return request<NotificationSetting[]>('GET', '/users/me/notification-settings', { accessToken })
}

/** 4.7 알림 설정 변경 — 한 유형씩 */
export function updateSetting(accessToken: string, input: Partial<NotificationSetting> & { type: NotificationType }) {
  return request<NotificationSetting>('PATCH', '/users/me/notification-settings', { body: input, accessToken })
}

/** 4.8 연동된 이메일 계정 */
export function listEmailIntegrations(accessToken: string) {
  return request<EmailIntegration[]>('GET', '/users/me/email-integrations', { accessToken })
}

/** 4.9 이메일 계정 연동 (OAuth 인가 코드) */
export function connectEmail(accessToken: string, provider: EmailIntegration['provider'], oauthCode: string) {
  return request<EmailIntegration>('POST', '/users/me/email-integrations', { body: { provider, oauth_code: oauthCode }, accessToken })
}

/** 4.10 이메일 연동 해제 */
export function disconnectEmail(accessToken: string, integrationId: string) {
  return request<null>('DELETE', `/users/me/email-integrations/${integrationId}`, { accessToken })
}
