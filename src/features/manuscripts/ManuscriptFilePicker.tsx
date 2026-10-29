import { useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { formatBytes } from '../../lib/format'
import { MANUSCRIPT_ACCEPT, type ManuscriptUpload } from './manuscriptUploadModel'
import './manuscript-files.css'

interface Props {
  items: ManuscriptUpload[]
  errors: string[]
  disabled?: boolean
  hideUploaded?: boolean
  onPick: (files: File[]) => void
  onRemove: (key: string) => void
  onRetry?: (key: string) => void
  children?: ReactNode
}

const STATUS = { queued: '대기', uploading: '올리는 중…', uploaded: '업로드 완료', failed: '업로드 실패' }

export function ManuscriptFilePicker({ items, errors, disabled, hideUploaded, onPick, onRemove, onRetry, children }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const hintId = useId()
  const visible = hideUploaded ? items.filter((item) => item.status !== 'uploaded') : items

  return (
    <div className="manuscript-files">
      <div
        className={`manuscript-files__drop${dragging && !disabled ? ' manuscript-files__drop--over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) onPick(Array.from(e.dataTransfer.files))
        }}
      >
        <p className="manuscript-files__title">원고 파일을 끌어다 놓으세요</p>
        <p id={hintId} className="manuscript-files__hint">여러 파일 선택 가능 · DOCX · TXT · 파일당 20MB</p>
        <div className="manuscript-files__actions">
          <Button tone="outline" disabled={disabled} aria-describedby={hintId} onClick={() => input.current?.click()}>
            {visible.length ? '파일 더 선택' : '파일 선택'}
          </Button>
          {children}
        </div>
        <input
          ref={input}
          type="file"
          aria-label="원고 파일 선택"
          accept={MANUSCRIPT_ACCEPT}
          multiple
          hidden
          disabled={disabled}
          onChange={(e) => {
            if (!disabled) onPick(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
      </div>
      {visible.length > 0 && (
        <ul className="manuscript-files__list" aria-label="선택한 파일">
          {visible.map((item) => (
            <li key={item.key} className="manuscript-files__item">
              <div className="manuscript-files__info">
                <p className="manuscript-files__name">{item.file.name}</p>
                <p className="manuscript-files__meta">{formatBytes(item.file.size)}</p>
                {item.error && <p className="manuscript-files__error" role="alert">{item.error}</p>}
              </div>
              <span className="manuscript-files__status" role="status">{STATUS[item.status]}</span>
              {item.status === 'failed' && onRetry && (
                <Button tone="outline" disabled={disabled} aria-label={`${item.file.name} 다시 시도`} onClick={() => onRetry(item.key)}>재시도</Button>
              )}
              {!item.manuscriptId && item.status !== 'uploading' && (
                <Button tone="soft" disabled={disabled} aria-label={`${item.file.name} 선택 취소`} onClick={() => onRemove(item.key)}>빼기</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {errors.length > 0 && (
        <ul className="manuscript-files__errors" role="alert">
          {errors.map((error, i) => <li key={`${i}-${error}`}>{error}</li>)}
        </ul>
      )}
    </div>
  )
}
