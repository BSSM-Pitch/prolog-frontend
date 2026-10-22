import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import * as projectsApi from '../../api/projects'
import { Button } from '../../components/Button'
import { useResource } from '../../lib/useResource'
import '../../components/ui.css'
import './ProjectPickerDialog.css'

interface ProjectPickerDialogProps {
  onPick: (projectId: string) => void
  onCancel: () => void
  onCreate: () => void
}

/** 프로젝트를 열지 않은 채 프로젝트 전용 메뉴를 눌렀을 때 뜨는 선택 창 */
export function ProjectPickerDialog({ onPick, onCancel, onCreate }: ProjectPickerDialogProps) {
  const projects = useResource((t) => projectsApi.listProjects(t, { sort: 'updated_desc', limit: 50 }), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const list = projects.data?.data ?? []

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="picker-title">
        <h2 id="picker-title" className="panel__title">
          프로젝트를 선택해 주세요
        </h2>
        <p className="page-desc">이 메뉴는 프로젝트 안에서 쓸 수 있어요.</p>
        {projects.loading && !projects.data ? (
          <p className="picker__state">불러오는 중…</p>
        ) : projects.error ? (
          <p className="picker__state" role="alert">
            {projects.error}
          </p>
        ) : list.length === 0 ? (
          <p className="picker__state">아직 프로젝트가 없어요.</p>
        ) : (
          <ul className="picker__list">
            {list.map((p) => (
              <li key={p.project_id}>
                <button type="button" className="picker__item" onClick={() => onPick(p.project_id)}>
                  <span className="picker__title">{p.title}</span>
                  <span className="picker__meta">{p.team_name ?? '개인'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="dialog__actions">
          <Button tone="outline" onClick={onCreate}>
            새 프로젝트
          </Button>
          <Button tone="outline" onClick={onCancel} autoFocus>
            닫기
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
