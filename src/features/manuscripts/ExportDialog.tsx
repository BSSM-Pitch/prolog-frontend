import { useRef, useState, type FormEvent } from 'react'
import type { Chapter } from '../../api/types'
import { fileRequest, downloadFile } from '../../api/files'
import { useSession } from '../../auth/session'
import { describeError } from '../../lib/errors'
import { InsightDialog } from '../insights/InsightDialog'
import '../insights/insights.css'
import '../world/narrativeBrowse.css'
export function ExportDialog({
  projectId,
  manuscriptId,
  title,
  chapters,
  current,
  beforeExport,
  onClose,
}: {
  projectId: string
  manuscriptId: string
  title: string
  chapters: Chapter[]
  current?: number
  beforeExport: () => Promise<boolean>
  onClose: () => void
}) {
  const { withAuth } = useSession()
  const ordered = [...chapters].sort((a, b) => a.chapter_no - b.chapter_no)
  const [format, setFormat] = useState('pdf')
  const [scope, setScope] = useState('all')
  const [start, setStart] = useState(ordered[0]?.chapter_no ?? 1)
  const [end, setEnd] = useState(ordered.at(-1)?.chapter_no ?? 1)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      if (!(await beforeExport())) {
        setError('원고 저장을 마친 뒤 다시 시도해 주세요.')
        return
      }
      const query = new URLSearchParams({ format })
      if (scope !== 'all') {
        query.set('from_chapter', String(scope === 'current' ? current : start))
        query.set('to_chapter', String(scope === 'current' ? current : end))
      }
      const response = await withAuth((token) =>
        fileRequest(token, `/projects/${projectId}/manuscripts/${manuscriptId}/export?${query}`),
      )
      const suffix = scope === 'all' ? '' : scope === 'current' ? `_${current}장` : `_${start}-${end}장`
      downloadFile(await response.blob(), `${title}${suffix}.${format}`)
      onClose()
    } catch (e) {
      setError(describeError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <InsightDialog title="원고 내보내기" onClose={onClose} busy={busy}>
      <p>편집 중인 내용을 저장한 뒤 선택한 형식으로 내려받아요.</p>
      <form className="writer-form" onSubmit={submit}>
        <label>
          파일 형식
          <select aria-label="파일 형식" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="pdf">PDF · 읽기와 공유</option>
            <option value="docx">DOCX · 문서 편집</option>
            <option value="txt">TXT · 텍스트 원문</option>
          </select>
        </label>
        <label>
          내보낼 범위
          <select aria-label="내보낼 범위" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">전체 원고</option>
            {current && <option value="current">현재 {current}장</option>}
            {ordered.length > 1 && <option value="range">장 범위 선택</option>}
          </select>
        </label>
        {scope === 'range' && (
          <>
            {(
              [
                ['시작 장', start, setStart],
                ['마지막 장', end, setEnd],
              ] as const
            ).map(([label, value, setter]) => (
              <label key={label}>
                {label}
                <select aria-label={label} value={value} onChange={(e) => setter(Number(e.target.value))}>
                  {ordered.map((c) => (
                    <option key={c.chapter_id} value={c.chapter_no}>
                      {c.chapter_no}장 {c.title}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {start > end && <p role="alert">마지막 장은 시작 장보다 앞설 수 없어요.</p>}
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {busy && <p role="status">파일을 만들고 있어요. 긴 원고는 잠시 시간이 걸릴 수 있어요.</p>}
        <div className="writer-actions">
          <button className="btn btn--outline" type="button" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button className="btn btn--primary" disabled={busy || (scope === 'range' && start > end)}>
            {busy ? '준비 중…' : '내려받기'}
          </button>
        </div>
      </form>
    </InsightDialog>
  )
}
