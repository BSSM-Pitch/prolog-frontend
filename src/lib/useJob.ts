import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConflictCheck } from '../api/types'
import { useSession } from '../auth/session'
import { describeError } from './errors'
import { createJobRequest } from './jobRequestModel'
import { pollResource } from './pollResource'

const RUNNING = ['queued', 'analyzing']
const REUSED_REVIEW_NOTICE = '원고와 설정이 바뀌지 않아 기존 검사 결과를 불러왔어요.'

/** Submission and polling both handle terminal responses; navigation only stops observation. */
export function useJob(
  poll: ((token: string, jobId: string) => Promise<ConflictCheck>) | null,
  onDone: (job: ConflictCheck) => void,
  scope: string,
) {
  const { withAuth } = useSession()
  const [job, setJob] = useState<ConflictCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const callbacks = useRef({ poll, onDone })
  callbacks.current = { poll, onDone }
  const running = job !== null && RUNNING.includes(job.status)
  const jobId = job?.job_id

  const submission = useMemo(() => createJobRequest<ConflictCheck>({
    onBusy: (busy) => {
      setStarting(busy)
      if (busy) { setError(null); setNotice(null) }
    },
    onResult: (next) => {
      setJob(next)
      if (!RUNNING.includes(next.status)) {
        callbacks.current.onDone(next)
        if (next.status === 'completed' && next.analysis_kind === 'narrative_review' && next.narrative && !next.narrative.stale)
          setNotice(REUSED_REVIEW_NOTICE)
      }
    },
    onError: (error) => setError(describeError(error)),
  // Each manuscript owns its submissions, even when the component stays mounted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [scope])

  useEffect(() => {
    setJob(null)
    setError(null)
    setNotice(null)
    setStarting(false)
    return () => submission.reset()
  }, [submission])

  useEffect(() => {
    if (!running || !jobId || !poll) return
    const stop = pollResource({
      load: () => withAuth((t) => callbacks.current.poll!(t, jobId)),
      onValue: (next) => {
        setError(null)
        setJob(next)
        if (!RUNNING.includes(next.status)) {
          stop()
          callbacks.current.onDone(next)
        }
      },
      onError: (error) => setError(describeError(error)),
      delay: () => 1000,
    })
    return stop
    // Callbacks stay current without restarting the poll on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, jobId, withAuth, scope])

  return { job, setJob, running, starting, notice, error, setError, clearNotice: () => setNotice(null), submit: submission.run }
}
