import { useEffect, useState } from 'react'
import * as api from '../../api/characters'
import type { NLExtraction } from '../../api/types'
import { useSession } from '../../auth/session'
import { describeError } from '../../lib/errors'
import { pollResource } from '../../lib/pollResource'
import { useResource } from '../../lib/useResource'
import { useJobRequest } from '../../lib/useJobRequest'
import { extractionRecoveryKey, recalledExtraction, rememberExtraction } from './extractionRecoveryModel'

/** Server history can also recover submissions accepted after this screen was closed. */
export function useExtraction(projectId: string, targetId: string) {
  const { user, withAuth } = useSession()
  const key = extractionRecoveryKey(user?.user_id ?? '', projectId, targetId)
  const [selectedId, setSelectedId] = useState(() => recalledExtraction(sessionStorage, key))
  const [job, setJob] = useState<NLExtraction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const history = useResource((token) => api.listExtractions(token, projectId), [projectId], {
    pollInterval: (rows) => !rows || rows.some((row) => row.status === 'analyzing') ? 2000 : 10000,
  })
  const action = useJobRequest<NLExtraction>(key, (next) => {
    setSelectedId(next.extraction_id)
    setJob(next)
    setError(null)
    setRevision((value) => value + 1)
    history.reload()
  })

  useEffect(() => {
    if (!selectedId) return
    return pollResource({
      load: () => withAuth((token) => api.getExtraction(token, projectId, selectedId)),
      onValue: (next) => { setJob(next); setError(null) },
      onError: (cause) => setError(describeError(cause)),
      delay: (next) => !next || next.status === 'analyzing' ? 1000 : false,
    })
  }, [projectId, selectedId, revision, withAuth])

  async function submit(request: (token: string) => Promise<NLExtraction>) {
    setError(null)
    await action.run(async () => {
      const next = await withAuth(request)
      // Persist even when navigation happened before the response arrived.
      rememberExtraction(sessionStorage, key, next.extraction_id)
      return next
    })
  }

  return {
    job: job?.extraction_id === selectedId ? job : null,
    selectedId, history, busy: action.busy, error: action.error ?? error,
    restoring: Boolean(selectedId && job?.extraction_id !== selectedId),
    submit,
    select: (id: string | null) => {
      if (action.busy) return
      rememberExtraction(sessionStorage, key, id)
      setSelectedId(id)
      setJob(null)
      setError(null)
      setRevision((value) => value + 1)
    },
  }
}
