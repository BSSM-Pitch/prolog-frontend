import { useEffect } from 'react'
import type { EmailIntegration, NotificationType } from '../../api/types'

// Figma 30 · 31 알림 유형
export const NOTIFICATION_LABEL: Record<NotificationType, { title: string; when: string }> = {
  team_invite: { title: '팀 초대', when: '팀에 초대받았을 때' },
  project_invite: { title: '프로젝트 초대', when: '프로젝트에 초대받았을 때' },
  team_joined: { title: '팀 합류', when: '내 팀에 누군가 합류했을 때' },
  mention: { title: '멘션', when: '원고나 메모에서 나를 언급했을 때' },
  system: { title: '시스템', when: '계정 연동, 서비스 안내' },
}
export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_LABEL) as NotificationType[]

export const PROVIDERS: Array<{ provider: EmailIntegration['provider']; name: string }> = [
  { provider: 'gmail', name: 'Gmail' },
  { provider: 'naver', name: '네이버 메일' },
]

// 알림을 읽거나 지우면 사이드바의 안 읽은 수를 다시 불러오게 알린다
const EVENT = 'prolog:notifications-changed'

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(EVENT))
}

export function useNotificationsChanged(onChange: () => void) {
  useEffect(() => {
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [onChange])
}
