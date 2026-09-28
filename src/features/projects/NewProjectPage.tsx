import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as manuscriptsApi from '../../api/manuscripts'
import * as projectsApi from '../../api/projects'
import * as teamsApi from '../../api/teams'
import type { OwnerType, Team } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { describeError } from '../../lib/errors'
import { formatBytes } from '../../lib/format'
import { projectPath } from '../app/currentProject'
import './NewProjectPage.css'

const ACCEPT = '.docx,.txt,.pdf'
type Start = { kind: 'none' } | { kind: 'file'; file: File } | { kind: 'editor' }

const OWNER_OPTIONS: Array<{ value: OwnerType; title: string; body: string }> = [
  { value: 'personal', title: '개인 프로젝트', body: '사용자를 초대해 함께 작업 가능' },
  { value: 'team', title: '팀 프로젝트', body: '선택한 팀이 소유하는 프로젝트' },
]

const baseName = (name: string) => name.replace(/\.[^.]+$/, '')

// Figma 1247:1989 새 프로젝트
export function NewProjectPage() {
  const navigate = useNavigate()
  const { withAuth } = useSession()
  const fileInput = useRef<HTMLInputElement>(null)

  // 팀 작업공간의 "새 프로젝트"로 들어오면 그 팀을 고른 채로 시작한다
  const presetTeam = useSearchParams()[0].get('team') ?? ''
  const [ownerType, setOwnerType] = useState<OwnerType>(presetTeam ? 'team' : 'personal')
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [teamId, setTeamId] = useState(presetTeam)
  const [title, setTitle] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [start, setStart] = useState<Start>({ kind: 'none' })
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    withAuth(teamsApi.listTeams)
      .then((list) => {
        setTeams(list)
        if (list[0]) setTeamId((id) => id || list[0].team_id)
      })
      .catch(() => setTeams([]))
  }, [withAuth])

  function pickFile(file: File | undefined) {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['docx', 'txt', 'pdf'].includes(ext)) {
      setFileError('DOCX · TXT · PDF 파일만 올릴 수 있어요.')
      return
    }
    setFileError(null)
    setStart({ kind: 'file', file })
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    pickFile(e.dataTransfer.files[0])
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const t = title.trim()
    if (!t) {
      setTitleError('프로젝트 이름을 입력해 주세요.')
      return
    }
    if (ownerType === 'team' && !teamId) {
      setFormError('팀 프로젝트를 만들 팀을 골라 주세요.')
      return
    }

    setBusy(true)
    try {
      const project = await withAuth((token) =>
        projectsApi.createProject(token, { title: t, owner_type: ownerType, team_id: ownerType === 'team' ? teamId : undefined }),
      )
      const id = project.project_id
      try {
        if (start.kind === 'file') {
          const file = start.file
          const ms = await withAuth((token) => manuscriptsApi.createManuscript(token, id, { title: baseName(file.name), source_type: 'file' }))
          await withAuth((token) => manuscriptsApi.uploadManuscriptFile(token, id, ms.manuscript_id, file))
          navigate(projectPath(id, 'manuscripts'), { replace: true })
          return
        }
        if (start.kind === 'editor') {
          const ms = await withAuth((token) => manuscriptsApi.createManuscript(token, id, { title: '1차 원고', source_type: 'editor' }))
          navigate(projectPath(id, `manuscripts/${ms.manuscript_id}`), { replace: true })
          return
        }
        navigate(projectPath(id), { replace: true })
      } catch (err) {
        // 프로젝트는 만들어졌으니 원고 화면에서 다시 시도하게 안내한다
        navigate(projectPath(id, 'manuscripts'), { replace: true, state: { notice: `프로젝트는 만들었지만 원고를 추가하지 못했어요. ${describeError(err)}` } })
      }
    } catch (err) {
      setFormError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const noTeams = teams !== null && teams.length === 0

  return (
    <div className="new-project">
      <header>
        <h1 className="page-title">새 프로젝트</h1>
        <p className="page-desc">어떤 작품을 만드실 건가요?</p>
      </header>

      <form className="panel new-project__form" onSubmit={onSubmit} noValidate>
        <h2 className="panel__title">프로젝트 만들기</h2>

        <fieldset className="new-project__fieldset">
          <legend className="field__label">작업 방식</legend>
          <div className="new-project__options" role="radiogroup" aria-label="작업 방식">
            {OWNER_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={ownerType === o.value}
                className="option new-project__option"
                onClick={() => setOwnerType(o.value)}
              >
                <span className="option__title">{o.title}</span>
                <span className="option__body">{o.body}</span>
              </button>
            ))}
          </div>
          {ownerType === 'team' &&
            (noTeams ? (
              <p className="notice notice--error">소속된 팀이 없어요. 팀에 초대받거나 팀을 만든 뒤 팀 프로젝트를 만들 수 있어요.</p>
            ) : (
              <label className="new-project__team">
                <span className="field__label">소유 팀</span>
                <select value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={teams === null}>
                  {teams === null && <option>불러오는 중…</option>}
                  {teams?.map((t) => (
                    <option key={t.team_id} value={t.team_id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </fieldset>

        <TextField
          label="프로젝트 이름"
          value={title}
          onChange={(v) => {
            setTitle(v)
            setTitleError(null)
          }}
          error={titleError}
          placeholder="해리포터"
          maxLength={100}
          autoFocus
        />

        <section className="new-project__start" aria-labelledby="start-title">
          <h3 id="start-title" className="new-project__start-title">
            원고 추가 <span>· 선택</span>
          </h3>
          <p className="page-desc">
            파일을 업로드하거나 빈 편집기에서 직접 작성할 수 있습니다.
            <br />한 프로젝트에 여러 원고를 업로드할 수 있습니다.
          </p>
          <div className="new-project__starts">
            <div
              className={[
                'dropzone',
                dragging && 'dropzone--over',
                start.kind === 'file' && 'dropzone--selected',
              ]
                .filter(Boolean)
                .join(' ')}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {start.kind === 'file' ? (
                <>
                  <p className="dropzone__title">{start.file.name}</p>
                  <p className="dropzone__hint">
                    {formatBytes(start.file.size)} · 파일 업로드본으로 만들어져요
                  </p>
                  <div className="dropzone__actions">
                    <Button tone="soft" onClick={() => fileInput.current?.click()}>
                      다른 파일
                    </Button>
                    <Button tone="outline" onClick={() => setStart({ kind: 'none' })}>
                      선택 취소
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="dropzone__title">원고 파일을 끌어다 놓거나 선택하세요</p>
                  <p className="dropzone__hint">DOCX · TXT · PDF · 파일 업로드본으로 만들어져요</p>
                  <Button tone="soft" onClick={() => fileInput.current?.click()}>
                    파일 선택
                  </Button>
                </>
              )}
              {fileError && (
                <p className="notice notice--error" role="alert">
                  {fileError}
                </p>
              )}
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                hidden
                onChange={(e) => {
                  pickFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>

            <div className={start.kind === 'editor' ? 'dropzone dropzone--selected' : 'dropzone'}>
              <p className="dropzone__title">빈 편집기로 시작</p>
              <p className="dropzone__hint">편집기 작성본으로 만들어져요</p>
              <Button
                tone="soft"
                aria-pressed={start.kind === 'editor'}
                onClick={() => setStart((s) => (s.kind === 'editor' ? { kind: 'none' } : { kind: 'editor' }))}
              >
                {start.kind === 'editor' ? '선택됨 · 취소' : '편집기 열기'}
              </Button>
            </div>
          </div>
        </section>

        {formError && (
          <p className="notice notice--error" role="alert">
            {formError}
          </p>
        )}
        <Button type="submit" size="xl" block busy={busy} disabled={ownerType === 'team' && noTeams}>
          {busy ? '만드는 중…' : '프로젝트 만들고 계속'}
        </Button>
      </form>
    </div>
  )
}
