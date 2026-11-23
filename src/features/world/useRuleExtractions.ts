import { useEffect, useRef, useState } from 'react'
import { listRuleExtractions } from '../../api/world'
import type { RuleExtraction } from '../../api/types'
import { useSession } from '../../auth/session'
import { describeError } from '../../lib/errors'
import { pollResource } from '../../lib/pollResource'

export function useRuleExtractions(projectId: string, onChange: () => void) {
  const { withAuth } = useSession()
  const [jobs, setJobs] = useState<RuleExtraction[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const changed = useRef(onChange)
  useEffect(() => { changed.current = onChange }, [onChange])

  useEffect(() => {
    let signature: string | undefined
    const stop = pollResource({
      load: () => withAuth((token) => listRuleExtractions(token, projectId)),
      onValue: (next) => {
        setJobs(next)
        setError(null)
        const nextSignature = JSON.stringify(next)
        if (signature !== nextSignature) changed.current()
        signature = nextSignature
      },
      onError: (e) => setError(describeError(e)),
      // Idle polling also recovers requests accepted after the previous screen unmounted.
      delay: (next) => !next || next.some(isRunning) ? 2000 : 10000,
    })
    const refresh = () => setRevision((r) => r + 1)
    window.addEventListener('focus', refresh)
    return () => { stop(); window.removeEventListener('focus', refresh) }
  }, [projectId, withAuth, revision])

  return { jobs, error, loading: jobs === null, refresh: () => setRevision((r) => r + 1) }
}

export function isRunning(job: RuleExtraction) {
  return job.status === 'queued' || job.status === 'analyzing'
}
