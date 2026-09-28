import { Button } from './Button'
import './ui.css'

interface ConfirmDialogProps {
  title: string
  body: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 되돌릴 수 없는 작업 확인 창 (Figma 상태 명세 · 확인과 경고) */
export function ConfirmDialog({ title, body, confirmLabel, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-body" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
        <h2 id="dialog-title" className="panel__title">
          {title}
        </h2>
        <p id="dialog-body" className="page-desc">
          {body}
        </p>
        <div className="dialog__actions">
          <Button tone="outline" onClick={onCancel} autoFocus>
            취소
          </Button>
          <Button tone="error" onClick={onConfirm} busy={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
