import { useRef, useState, type DragEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../api/manuscripts'
import type { Manuscript } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { describeError } from '../../lib/errors'
import { formatBytes, formatCount } from '../../lib/format'
import { relativeTime } from '../../lib/relativeTime'
import { useInterval, useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import './ManuscriptsPage.css'

const ACCEPT = '.docx,.txt,.pdf'
const FORMATS = ['docx', 'txt', 'pdf']
const baseName = (name: string) => name.replace(/\.[^.]+$/, '')

const SOURCE_LABEL = { file: '파일 업로드본', editor: '편집기 작성본' } as const

// Figma 841:376 · 18 원고 업로드
export function ManuscriptsPage() {
  const project = useProject()
  const navigate = useNavigate()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const { withAuth } = useSession()
  const fileInput = useRef<HTMLInputElement>(null)
  const retryTarget = useRef<string | null>(null)

  const projectId = project?.project_id ?? ''
  const list = useResource(project ? (token) => api.listManuscripts(token, projectId) : null, [projectId])
  const manuscripts = list.data ?? []

  const [picked, setPicked] = useState<File[]>([])
  const [pickError, setPickError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [sessionIds, setSessionIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Manuscript | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [creating, setCreating] = useState(false)

  // 처리 중인 원고가 있으면 상태를 계속 확인한다 (MSU 4.6 비고: 상세 조회로 status 폴링)
  const processing = manuscripts.some((m) => m.status === 'processing')
  useInterval(list.reload, 1500, processing)

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>

  const ready = manuscripts.filter((m) => m.status === 'ready')
  const selected = ready.find((m) => m.manuscript_id === selectedId) ?? ready[0] ?? null
  // "업로드 진행"에는 이번에 올린 파일과, 아직 처리 중이거나 실패한 파일을 보여 준다
  const progress = manuscripts.filter((m) => m.source_type === 'file' && (sessionIds.includes(m.manuscript_id) || m.status !== 'ready'))

  function pick(files: FileList | File[] | null) {
    if (!files) return
    const all = Array.from(files)
    const ok = all.filter((f) => FORMATS.includes(f.name.split('.').pop()?.toLowerCase() ?? ''))
    setPickError(ok.length < all.length ? 'DOCX · TXT · PDF 파일만 올릴 수 있어요. 다른 형식은 뺐어요.' : null)
    setPicked(ok)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files)
  }

  async function upload(files: File[], replaceId: string | null) {
    setUploading(true)
    setUploadError(null)
    const errors: string[] = []
    for (const file of files) {
      try {
        const id =
          replaceId ??
          (await withAuth((t) => api.createManuscript(t, projectId, { title: baseName(file.name), source_type: 'file' }))).manuscript_id
        await withAuth((t) => api.uploadManuscriptFile(t, projectId, id, file))
        setSessionIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
        list.reload() // 올린 파일이 바로 "처리 중"으로 보이도록
      } catch (err) {
        errors.push(`${file.name}: ${describeError(err)}`)
      }
    }
    setUploading(false)
    setPicked([])
    if (errors.length) setUploadError(errors.join('\n'))
    list.reload()
  }

  async function createEditorManuscript() {
    setCreating(true)
    try {
      const ms = await withAuth((t) => api.createManuscript(t, projectId, { title: `${manuscripts.length + 1}차 원고`, source_type: 'editor' }))
      navigate(projectPath(projectId, `manuscripts/${ms.manuscript_id}`))
    } catch (err) {
      setUploadError(describeError(err))
      setCreating(false)
    }
  }

  async function remove(m: Manuscript) {
    setDeleting(true)
    try {
      await withAuth((t) => api.deleteManuscript(t, projectId, m.manuscript_id))
      list.setData((prev) => prev?.filter((x) => x.manuscript_id !== m.manuscript_id) ?? null)
      setConfirmDelete(null)
    } catch (err) {
      setUploadError(describeError(err))
    } finally {
      setDeleting(false)
    }
  }

  const canEdit = project.my_role !== 'viewer'

  return (
    <div className="manuscripts">
      <header>
        <p className="page-crumb">원고 관리 / 프로젝트에 추가</p>
        <h1 className="page-title">원고 업로드</h1>
        <p className="page-desc">파일을 추가하고 진행 상태를 확인하세요.</p>
      </header>
      {notice && (
        <p className="notice notice--error" role="alert">
          {notice}
        </p>
      )}

      <div className="manuscripts__layout">
        <div className="manuscripts__main">
          <section className="panel" aria-labelledby="add-title">
            <h2 id="add-title" className="panel__title">
              파일 추가
            </h2>
            <div
              className={dragging ? 'upload-drop upload-drop--over' : 'upload-drop'}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <p className="upload-drop__title">원고 파일을 이곳에 놓아주세요</p>
              <p className="upload-drop__hint">DOCX · TXT · PDF 등</p>
              <div className="upload-drop__actions">
                <Button tone="outline" onClick={() => fileInput.current?.click()} disabled={!canEdit || uploading}>
                  파일 선택
                </Button>
                <Button onClick={() => upload(picked, null)} disabled={!canEdit || picked.length === 0} busy={uploading}>
                  {uploading ? '올리는 중…' : '업로드 시작'}
                </Button>
              </div>
            </div>
            {picked.length > 0 && (
              <p className="manuscripts__picked">
                선택됨 · {picked.map((f) => `${f.name} · ${formatBytes(f.size)}`).join(', ')}
              </p>
            )}
            {!canEdit && <p className="panel__label">보기 전용 멤버는 원고를 올릴 수 없어요.</p>}
            {pickError && <p className="notice notice--error">{pickError}</p>}
            {uploadError && (
              <p className="notice notice--error notice--block" role="alert">
                {uploadError}
              </p>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                const target = retryTarget.current
                retryTarget.current = null
                if (target && e.target.files?.[0]) upload([e.target.files[0]], target)
                else pick(e.target.files)
                e.target.value = ''
              }}
            />
          </section>

          <section className="panel" aria-labelledby="progress-title">
            <h2 id="progress-title" className="panel__title">
              업로드 진행
            </h2>
            {progress.length === 0 ? (
              <p className="panel__label">이번에 올린 파일이 여기에 표시돼요.</p>
            ) : (
              <ul className="upload-list">
                {progress.map((m) => (
                  <li key={m.manuscript_id} className={`upload-item upload-item--${m.status}`}>
                    <p className="upload-item__name">
                      {m.file_name ?? m.title}
                      {m.status === 'extraction_failed' && <span className="badge badge--error">텍스트 추출 실패</span>}
                    </p>
                    {m.status === 'processing' && (
                      <>
                        <p className="upload-item__meta" role="status">
                          처리 중 · 텍스트를 추출하고 있어요
                        </p>
                        <div className="upload-item__bar" aria-hidden="true">
                          <span />
                        </div>
                      </>
                    )}
                    {m.status === 'ready' && (
                      <p className="upload-item__meta">완료 · 텍스트 변환됨 · 챕터 {m.chapter_count}개</p>
                    )}
                    {m.status === 'extraction_failed' && (
                      <>
                        <p className="upload-item__meta">{m.error?.message}</p>
                        <div className="upload-item__actions">
                          <Button
                            tone="outline"
                            onClick={() => {
                              retryTarget.current = m.manuscript_id
                              fileInput.current?.click()
                            }}
                            disabled={!canEdit || uploading}
                          >
                            다른 파일로 다시 올리기
                          </Button>
                          <Button tone="outline" onClick={() => setConfirmDelete(m)} disabled={!canEdit}>
                            제거
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="panel manuscripts__side" aria-labelledby="list-title">
          <div className="manuscripts__side-head">
            <h2 id="list-title" className="panel__title">
              프로젝트 원고
            </h2>
            {canEdit && (
              <Button tone="soft" onClick={createEditorManuscript} busy={creating}>
                새로 쓰기
              </Button>
            )}
          </div>
          {list.loading && !list.data && <p className="panel__label">원고를 불러오고 있어요</p>}
          {list.error && !list.data && (
            <div role="alert">
              <p className="notice notice--error">{list.error}</p>
              <Button tone="outline" onClick={list.reload}>
                다시 시도
              </Button>
            </div>
          )}
          {list.data && ready.length === 0 && <p className="panel__label">아직 준비된 원고가 없어요. 파일을 올리거나 새로 써 보세요.</p>}
          <ul className="ms-list">
            {ready.map((m) => {
              const isSelected = selected?.manuscript_id === m.manuscript_id
              const editorPath = projectPath(projectId, `manuscripts/${m.manuscript_id}`)
              return (
                <li key={m.manuscript_id}>
                  <div className={isSelected ? 'ms-card ms-card--selected' : 'ms-card'}>
                    <button type="button" className="ms-card__select" onClick={() => setSelectedId(m.manuscript_id)} aria-pressed={isSelected}>
                      <span className="ms-card__title">
                        {project.title} / {m.title}
                      </span>
                      <span className="ms-card__meta">
                        {m.chapter_count}장 · {formatCount(m.char_count)}자 · {relativeTime(m.updated_at)} 업데이트
                      </span>
                    </button>
                    <div className="ms-card__badges">
                      <span className="badge badge--filled">
                        {SOURCE_LABEL[m.source_type]}
                        {m.file_format ? ` · ${m.file_format.toUpperCase()}` : ''}
                      </span>
                      <span className="badge badge--success">준비됨</span>
                    </div>
                    {isSelected ? (
                      <Link className="btn btn--primary btn--block" to={editorPath}>
                        편집기 열기
                      </Link>
                    ) : (
                      <div className="ms-card__actions">
                        <Link className="btn btn--outline" to={editorPath}>
                          열기
                        </Link>
                        {canEdit && (
                          <Button tone="error" onClick={() => setConfirmDelete(m)}>
                            제거
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="원고를 제거할까요?"
          body={`“${confirmDelete.title}”과 모든 장이 사라지고 되돌릴 수 없어요.`}
          confirmLabel="제거"
          busy={deleting}
          onConfirm={() => remove(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
