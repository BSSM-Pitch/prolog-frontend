import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import type { Conflict, ConflictCheck } from '../../api/types'
import * as api from '../../api/world'
import { useSession } from '../../auth/session'
import { describeError } from '../../lib/errors'
import { useJob } from '../../lib/useJob'
import { useResource } from '../../lib/useResource'
import { manuscriptIssues } from './manuscriptReviewModel'
import './manuscript-review.css'

interface Props {
  projectId: string
  manuscriptId: string
  chapterId: string
  chapterNo: number
  value: string
  readOnly: boolean
  textRef: RefObject<HTMLTextAreaElement | null>
  onChange: (value: string) => void
  onCompositionChange: (active: boolean) => void
  beforeCheck: () => Promise<boolean>
  onOpenReview: (conflict: Conflict) => void
}

const SKIPPED: Record<string, string> = {
  NO_MANUSCRIPT: '검사할 원고가 없어요.',
  NO_CHARACTERS: '등장인물을 먼저 확정해 주세요.',
  NO_RULES: '세계관에 설정 규칙을 먼저 추가해 주세요.',
  NO_REFERENCE_DATA: '비교할 인물 설정이나 규칙이 아직 없어요.',
}

/** textarea를 유지해 한글 조합·선택·실행 취소·자동 저장을 보존한다. 밑줄만 별도 층에 그린다. */
export function ReviewedManuscript(props: Props) {
  const { projectId, manuscriptId, chapterId, chapterNo, value, readOnly, textRef } = props
  const { withAuth } = useSession()
  const review = useResource((token) => api.listConflicts(token, projectId), [projectId, chapterId])
  const reloadReview = review.reload
  const issues = useMemo(
    () => manuscriptIssues(value, chapterId, review.data ?? []),
    [value, chapterId, review.data],
  )
  const [open, setOpen] = useState<{
    key: string
    item: number
    left: number
    top: number
    anchorTop: number
    anchorBottom: number
  } | null>(null)
  const [composing, setComposing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const submitLock = useRef(false)
  const programmaticScroll = useRef(false)
  const mirror = useRef<HTMLDivElement>(null)
  const mirrorText = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const countButton = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  const issueKey = (index: number) => issues[index]?.conflicts.map((c) => c.conflict_id).join('|')
  const active = open
    ? issues.find((issue) => issue.conflicts.map((c) => c.conflict_id).join('|') === open.key)
    : null
  const conflict = active?.conflicts[open?.item ?? 0]

  useLayoutEffect(() => {
    if (!open || !card.current) return
    const rect = card.current.getBoundingClientRect()
    const below = open.anchorBottom + 8
    const top =
      below + rect.height <= window.innerHeight - 16 ? below : Math.max(16, open.anchorTop - rect.height - 8)
    if (top !== open.top) setOpen({ ...open, top })
  }, [open, conflict])

  function completed(job: ConflictCheck) {
    review.reload()
    if (job.status === 'failed') setMessage('검사를 마치지 못했어요. 다시 시도해 주세요.')
    else if (job.status === 'skipped')
      setMessage(SKIPPED[job.skipped_reason ?? ''] ?? '지금은 검사할 수 없어요.')
    else setMessage(null)
  }
  const check = useJob((token, id) => api.getConflictCheck(token, projectId, id), completed)
  const checking = starting || check.running

  async function startCheck() {
    if (submitLock.current || check.running || readOnly) return
    submitLock.current = true
    setStarting(true)
    setMessage(null)
    check.setError(null)
    try {
      if (!(await props.beforeCheck())) {
        setMessage('원고를 저장한 뒤 다시 검사해 주세요.')
        return
      }
      const job = await withAuth((token) => api.rescan(token, projectId, false, { manuscriptId, chapterId }))
      check.setJob(job)
      if (!['queued', 'analyzing'].includes(job.status)) completed(job)
    } catch (error) {
      check.setError(describeError(error))
    } finally {
      setStarting(false)
      submitLock.current = false
    }
  }

  async function retry() {
    if (!check.job || submitLock.current) return
    submitLock.current = true
    setStarting(true)
    try {
      check.setError(null)
      const next = await withAuth((token) => api.retryConflictCheck(token, projectId, check.job!.job_id))
      check.setJob(next)
      setMessage(null)
      if (!['queued', 'analyzing'].includes(next.status)) completed(next)
    } catch (error) {
      check.setError(describeError(error))
    } finally {
      setStarting(false)
      submitLock.current = false
    }
  }

  const syncMirror = useCallback(() => {
    const input = textRef.current
    if (!input || !mirror.current || !mirrorText.current) return
    mirror.current.style.width = `${input.clientWidth}px`
    mirror.current.style.height = `${input.clientHeight}px`
    mirrorText.current.style.transform = `translate(${-input.scrollLeft}px, ${-input.scrollTop}px)`
  }, [textRef])

  useLayoutEffect(() => {
    syncMirror()
    const observer = new ResizeObserver(() => {
      syncMirror()
      setOpen(null)
    })
    if (textRef.current) observer.observe(textRef.current)
    return () => observer.disconnect()
  }, [textRef, syncMirror])
  useLayoutEffect(() => {
    syncMirror()
  }, [value, issues, syncMirror])

  useEffect(() => {
    const reload = () => reloadReview()
    window.addEventListener('focus', reload)
    return () => window.removeEventListener('focus', reload)
  }, [reloadReview])

  function close(restore = false) {
    setOpen(null)
    setActionError(null)
    if (restore)
      requestAnimationFrame(() => {
        const target = returnFocus.current?.isConnected ? returnFocus.current : textRef.current
        target?.focus({ preventScroll: true })
      })
  }

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (
        !card.current?.contains(event.target as Node) &&
        event.target !== textRef.current &&
        event.target !== countButton.current
      )
        setOpen(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(null)
        returnFocus.current?.focus({ preventScroll: true })
      }
    }
    const reposition = (event: Event) => {
      if (programmaticScroll.current && event.target === textRef.current) return
      if (!card.current?.contains(event.target as Node)) setOpen(null)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, textRef])

  function show(index: number, keyboard = false, clickedRect?: DOMRect) {
    const mark = mirrorText.current?.querySelector<HTMLElement>(`[data-issue="${index}"]`)
    const input = textRef.current
    if (!mark || !input || composing) return
    if (!card.current?.contains(document.activeElement))
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : input
    if (keyboard) {
      const previousScroll = input.scrollTop
      input.scrollTop += mark.getBoundingClientRect().top - input.getBoundingClientRect().top - 60
      programmaticScroll.current = input.scrollTop !== previousScroll
      syncMirror()
    }
    const rect = clickedRect ?? mark.getClientRects()[0]
    if (!rect) return
    setActionError(null)
    setOpen({
      key: issueKey(index),
      item: 0,
      left: Math.max(16, Math.min(rect.left, window.innerWidth - 356)),
      top: rect.bottom + 8,
      anchorTop: rect.top,
      anchorBottom: rect.bottom,
    })
    if (keyboard) requestAnimationFrame(() => closeButton.current?.focus({ preventScroll: true }))
  }

  async function ignore() {
    if (!conflict || dismissing || readOnly) return
    setDismissing(true)
    setActionError(null)
    try {
      const updated = await withAuth((token) =>
        api.resolveConflict(token, projectId, conflict.conflict_id, { action: 'ignored' }),
      )
      review.setData(
        (rows) => rows?.map((row) => (row.conflict_id === updated.conflict_id ? updated : row)) ?? null,
      )
      close(true)
    } catch (error) {
      setActionError(describeError(error))
    } finally {
      setDismissing(false)
    }
  }

  const segments = issues.map((issue, index) => {
    const before = value.slice(index ? issues[index - 1].end : 0, issue.start)
    return (
      <Fragment key={issueKey(index)}>
        {before}
        <span data-issue={index} className="manuscript-review__underline">
          {value.slice(issue.start, issue.end)}
        </span>
      </Fragment>
    )
  })
  const error = check.error ?? review.error
  return (
    <div className="manuscript-review">
      <div className="manuscript-review__tools">
        {issues.length > 0 && (
          <button
            ref={countButton}
            type="button"
            className="manuscript-review__count"
            onClick={() => show(0, true)}
          >
            검토 {issues.length}곳
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            className="text-link"
            disabled={checking || composing || !value.trim()}
            onClick={check.job?.status === 'failed' ? retry : startCheck}
          >
            {checking ? '검사 중…' : check.job?.status === 'failed' ? '검사 다시 시도' : '설정 검사'}
          </button>
        )}
      </div>
      {(error || message) && (
        <p className="manuscript-review__notice" role="status">
          {error ?? message}
          {review.error && (
            <button type="button" className="text-link" onClick={review.reload}>
              다시 불러오기
            </button>
          )}
        </p>
      )}
      <div className="textbox editor__text manuscript-review__input">
        <div className="manuscript-review__surface">
          <div
            ref={mirror}
            className="manuscript-review__mirror"
            aria-hidden="true"
            style={{ visibility: composing ? 'hidden' : undefined }}
          >
            <div ref={mirrorText}>
              {segments}
              {value.slice(issues.at(-1)?.end ?? 0)}
              {'\u200b'}
            </div>
          </div>
          <textarea
            ref={textRef}
            className="textbox__input manuscript-review__textarea"
            value={value}
            readOnly={readOnly}
            aria-label={`${chapterNo}장 본문`}
            placeholder="여기에 이야기를 써 보세요."
            spellCheck={false}
            onChange={(event) => {
              close()
              props.onChange(event.target.value)
            }}
            onBlur={() => void props.beforeCheck()}
            onCompositionStart={() => {
              setComposing(true)
              props.onCompositionChange(true)
              close()
            }}
            onCompositionEnd={() => {
              setComposing(false)
              props.onCompositionChange(false)
            }}
            onScroll={() => {
              syncMirror()
              if (!programmaticScroll.current) close()
              programmaticScroll.current = false
            }}
            onClick={(event) => {
              const input = event.currentTarget
              if (composing || input.selectionStart !== input.selectionEnd) {
                close()
                return
              }
              const marks = mirrorText.current?.querySelectorAll<HTMLElement>('[data-issue]') ?? []
              for (const mark of marks) {
                const rect = [...mark.getClientRects()].find(
                  (r) =>
                    event.clientX >= r.left &&
                    event.clientX <= r.right &&
                    event.clientY >= r.top &&
                    event.clientY <= r.bottom + 5,
                )
                if (rect) {
                  show(Number(mark.dataset.issue), false, rect)
                  return
                }
              }
              close()
            }}
          />
        </div>
      </div>
      {open &&
        active &&
        conflict &&
        createPortal(
          <div
            ref={card}
            className="manuscript-review__card"
            role="dialog"
            aria-labelledby={titleId}
            style={{ left: open.left, top: open.top }}
          >
            <div className="manuscript-review__card-head">
              <span>
                설정 확인{active.conflicts.length > 1 ? ` · ${open.item + 1}/${active.conflicts.length}` : ''}
              </span>
              <button ref={closeButton} type="button" aria-label="검토 설명 닫기" onClick={() => close(true)}>
                ×
              </button>
            </div>
            <h2 id={titleId}>{conflict.title}</h2>
            {conflict.evidence[0]?.quote && <blockquote>{conflict.evidence[0].quote}</blockquote>}
            <p className="manuscript-review__advice">{conflict.advice}</p>
            {actionError && <p role="alert">{actionError}</p>}
            <div className="manuscript-review__actions">
              <button type="button" className="text-link" onClick={() => props.onOpenReview(conflict)}>
                자세히 검토
              </button>
              {(active.conflicts.length > 1 || issues.length > 1) && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    if (open.item + 1 < active.conflicts.length) setOpen({ ...open, item: open.item + 1 })
                    else show((issues.indexOf(active) + 1) % issues.length, true)
                  }}
                >
                  다음
                </button>
              )}
              {!readOnly && (
                <button type="button" className="text-link" disabled={dismissing} onClick={ignore}>
                  {dismissing ? '처리 중…' : '무시'}
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
