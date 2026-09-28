import { useEffect, useState } from 'react'
import type { ConflictCheck } from '../api/types'
import { useSession } from '../auth/session'
import { describeError } from './errors'

const RUNNING = ['queued', 'analyzing']

/**
 * 비동기 작업(충돌 검사·규칙 추출)을 끝날 때까지 1초마다 확인한다.
 * 끝나면(completed·failed·skipped) onDone을 한 번 부른다.
 */
export function useJob(poll: ((token: string, jobId: string) => Promise<ConflictCheck>) | null, onDone: (job: ConflictCheck) => void) {
  const { withAuth } = useSession()
  const [job, setJob] = useState<ConflictCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const running = job !== null && RUNNING.includes(job.status)
  const jobId = job?.job_id

  useEffect(() => {
    if (!running || !jobId || !poll) return
    let cancelled = false
    const id = window.setInterval(() => {
      withAuth((t) => poll(t, jobId))
        .then((next) => {
          if (cancelled) return
          setJob(next)
          if (!RUNNING.includes(next.status)) onDone(next)
        })
        .catch((e) => !cancelled && setError(describeError(e)))
    }, 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
    // poll·onDone은 매 렌더 새로 만들어지므로 작업 ID와 진행 여부로만 반응한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, jobId, withAuth])

  return { job, setJob, running, error, setError }
}
