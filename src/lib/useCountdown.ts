import { useCallback, useEffect, useState } from 'react'

/** 인증 코드 남은 시간. start(초)로 시작하고, 0이 되면 expired가 true가 된다. */
export function useCountdown() {
  const [deadline, setDeadline] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (deadline === null) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [deadline])

  const start = useCallback((seconds: number) => {
    setNow(Date.now())
    setDeadline(Date.now() + seconds * 1000)
  }, [])

  const remaining = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000))
  const label = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`

  return { started: deadline !== null, remaining, expired: deadline !== null && remaining === 0, label, start }
}
