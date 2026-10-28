import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import * as api from '../../api/story'
import type { StructureAnalysis } from '../../api/types'
import { useSession } from '../../auth/session'
import { describeError } from '../../lib/errors'

/** 원고별로 마운트한다. 화면을 떠나도 같은 탭에서 진행 중인 분석을 다시 확인할 수 있다. */
export function useStoryAnalysis(projectId: string, manuscriptId: string, onCompleted: () => void) {
  const { user, withAuth } = useSession()
  const storageKey = `prolog:structure-analysis:${user?.user_id}:${projectId}:${manuscriptId}`
  const [job, setJob] = useState<StructureAnalysis | null>(() => {
    try {
      const id = sessionStorage.getItem(storageKey)
      return id ? { analysis_id: id, manuscript_id: manuscriptId, status: 'queued' } : null
    } catch {
      return null
    }
  })
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const submitting = useRef(false)
  const mounted = useRef(false)
  const running = job?.status === 'queued' || job?.status === 'analyzing'
  const jobId = job?.analysis_id

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!running || !jobId) return
    let cancelled = false
    let timer: number | undefined
    async function poll() {
      try {
        const next = await withAuth((token) => api.getAnalysis(token, projectId, manuscriptId, jobId!))
        if (cancelled) return
        setJob(next)
        setPollError(null)
        if (next.status === 'completed' || next.status === 'failed') {
          try {
            sessionStorage.removeItem(storageKey)
          } catch {
            /* 저장소가 막혀 있어도 분석은 계속한다. */
          }
          if (next.status === 'completed') onCompleted()
        } else {
          timer = window.setTimeout(poll, 1200)
        }
      } catch (e) {
        if (cancelled) return
        if (e instanceof ApiError && e.code === 'STRUCTURE_ANALYSIS_NOT_FOUND') {
          try {
            sessionStorage.removeItem(storageKey)
          } catch {
            /* 선택적 복원 정보 */
          }
          setJob(null)
          setError('진행 중이던 분석을 찾을 수 없어요. 다시 분석해 주세요.')
        } else {
          setPollError(describeError(e))
        }
      }
    }
    void poll()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [running, jobId, projectId, manuscriptId, withAuth, storageKey, attempt, onCompleted])

  async function analyze() {
    if (submitting.current || running) return
    submitting.current = true
    setStarting(true)
    setError(null)
    setPollError(null)
    try {
      const next = await withAuth((token) => api.analyzeStructure(token, projectId, manuscriptId))
      const active = next.status === 'queued' || next.status === 'analyzing'
      // 원고를 옮긴 사이 응답이 와도 작업 ID는 보존하되 다른 원고의 화면을 갱신하지 않는다.
      try {
        if (active) sessionStorage.setItem(storageKey, next.analysis_id)
        else sessionStorage.removeItem(storageKey)
      } catch {
        /* 선택적 복원 정보 */
      }
      if (!mounted.current) return
      setJob(next)
      if (next.status === 'completed') onCompleted()
    } catch (e) {
      if (mounted.current) setError(describeError(e))
    } finally {
      submitting.current = false
      if (mounted.current) setStarting(false)
    }
  }

  return {
    analyze,
    running: starting || running,
    failed: job?.status === 'failed',
    error,
    pollError,
    resume: () => {
      setPollError(null)
      setAttempt((value) => value + 1)
    },
  }
}
