import { useEffect, useRef, useState } from 'react'
import { exportManuscript, type ExportFormat } from '../api/manuscripts'
import { useSession } from '../auth/session'
import { describeError } from '../lib/errors'
import { saveFile } from '../lib/saveFile'
import { Button } from './Button'
import './ExportMenu.css'

const FORMATS: Array<{ format: ExportFormat; label: string; hint: string }> = [
  { format: 'txt', label: '텍스트(.txt)', hint: '어디서든 열려요' },
  { format: 'docx', label: '워드(.docx)', hint: '장 제목이 제목 스타일로 들어가요' },
]

interface ExportMenuProps {
  projectId: string
  manuscriptId: string
  title: string
  /** 내보내기 직전에 할 일. false를 돌려주면 내보내지 않는다 (편집기: 저장하지 않은 글 저장) */
  beforeExport?: () => Promise<boolean>
  tone?: 'outline' | 'soft'
  disabled?: boolean
  /** 메뉴를 열었을 때 맞출 가장자리 */
  align?: 'start' | 'end'
}

/** 원고 내보내기 — 형식을 고르면 파일이 바로 내려받아진다 */
export function ExportMenu({ projectId, manuscriptId, title, beforeExport, tone = 'outline', disabled, align = 'start' }: ExportMenuProps) {
  const { withAuth } = useSession()
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  async function run(format: ExportFormat) {
    if (busy) return
    setBusy(format)
    setError(null)
    try {
      if (beforeExport && !(await beforeExport())) {
        setError('저장하지 못해 내보내지 않았어요. 잠시 뒤 다시 시도해 주세요.')
        return
      }
      const { blob, fileName } = await withAuth((t) => exportManuscript(t, projectId, manuscriptId, format, title))
      saveFile(blob, fileName)
      setOpen(false)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="export-menu" ref={root}>
      <Button tone={tone} onClick={() => setOpen((v) => !v)} disabled={disabled} aria-haspopup="menu" aria-expanded={open}>
        내보내기
      </Button>
      {open && (
        <div className={`export-menu__list export-menu__list--${align}`} role="menu" aria-label="내보내기 형식">
          {FORMATS.map((f) => (
            <button key={f.format} type="button" role="menuitem" className="export-menu__item" onClick={() => run(f.format)} disabled={Boolean(busy)}>
              <span className="export-menu__label">{busy === f.format ? '만드는 중…' : f.label}</span>
              <span className="export-menu__hint">{f.hint}</span>
            </button>
          ))}
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
