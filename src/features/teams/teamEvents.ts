import { useEffect } from 'react'

// 팀을 만들거나 나가면 사이드바의 팀 목록을 다시 불러오게 알린다
const EVENT = 'prolog:teams-changed'

export function notifyTeamsChanged() {
  window.dispatchEvent(new Event(EVENT))
}

export function useTeamsChanged(onChange: () => void) {
  useEffect(() => {
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [onChange])
}
