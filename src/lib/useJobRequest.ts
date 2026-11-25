import { useEffect, useMemo, useRef, useState } from 'react'
import { createJobRequest } from './jobRequestModel'
import { describeError } from './errors'

/** A request lock and visible feedback, scoped to the resource that owns the action. */
export function useJobRequest<T>(scope: string, onResult: (value: T) => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accepted = useRef(onResult)
  accepted.current = onResult
  const request = useMemo(() => createJobRequest<T>({
    onBusy: (next) => { setBusy(next); if (next) setError(null) },
    onResult: (value) => accepted.current(value),
    onError: (cause) => setError(describeError(cause)),
  // The scope deliberately owns the request lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [scope])
  useEffect(() => {
    setBusy(false)
    setError(null)
    return () => request.reset()
  }, [request])
  return { busy, error, run: request.run }
}
