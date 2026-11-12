import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import * as projectsApi from '../../api/projects'
import type { Project } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { describeError } from '../../lib/errors'

interface DeleteProjectDialogProps {
  project: Project
  onCancel: () => void
}

/** 작품 삭제 확인 — 되돌릴 수 없어서 작품 이름을 직접 입력해야 지워진다 */
export function DeleteProjectDialog({ project, onCancel }: DeleteProjectDialogProps) {
  const navigate = useNavigate()
  const { withAuth } = useSession()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const matches = typed.trim() === project.title.trim()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!matches || busy) return
    setBusy(true)
    setError(null)
    try {
      await withAuth((t) => projectsApi.deleteProject(t, project.project_id))
      navigate('/projects', { replace: true })
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <form
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
        aria-describedby="delete-project-body"
        onSubmit={onSubmit}
        onKeyDown={(e) => e.key === 'Escape' && !busy && onCancel()}
        noValidate
      >
        <h2 id="delete-project-title" className="panel__title">
          작품을 삭제할까요?
        </h2>
        <p id="delete-project-body" className="page-desc">
          “{project.title}”의 원고·장·인물·설정·복선과 AI 기록이 모두 사라지고 되돌릴 수 없어요. 필요한 원고는 먼저 내보내 두세요.
        </p>
        <TextField label={`확인을 위해 작품 이름을 입력하세요`} value={typed} onChange={setTyped} placeholder={project.title} autoFocus disabled={busy} />
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <Button tone="outline" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button type="submit" tone="error" busy={busy} disabled={!matches}>
            작품 삭제
          </Button>
        </div>
      </form>
    </div>
  )
}
