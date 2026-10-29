import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as manuscriptsApi from '../../api/manuscripts'
import * as projectsApi from '../../api/projects'
import * as teamsApi from '../../api/teams'
import type { OwnerType, Team } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { describeError } from '../../lib/errors'
import { projectPath } from '../app/currentProject'
import { ManuscriptFilePicker } from '../manuscripts/ManuscriptFilePicker'
import { validateManuscriptFile } from '../manuscripts/manuscriptUploadModel'
import { useManuscriptUploads } from '../manuscripts/useManuscriptUploads'
import './NewProjectPage.css'
import { Select } from '../../components/Select'

type Start = 'none' | 'editor'

const OWNER_OPTIONS: Array<{ value: OwnerType; title: string; body: string }> = [
  { value: 'personal', title: '개인 작품', body: '혼자 시작하고, 동료를 초대할 수 있어요.' },
  { value: 'team', title: '팀 작품', body: '팀과 함께 원고를 나눠요.' },
]

// Figma 1247:1989 새 작품
export function NewProjectPage() {
  const navigate = useNavigate()
  const { withAuth } = useSession()
  const submitting = useRef(false)
  const uploads = useManuscriptUploads()

  // 팀 작업공간의 "새 작품"로 들어오면 그 팀을 고른 채로 시작한다
  const presetTeam = useSearchParams()[0].get('team') ?? ''
  const [ownerType, setOwnerType] = useState<OwnerType>(presetTeam ? 'team' : 'personal')
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [teamId, setTeamId] = useState(presetTeam)
  const [title, setTitle] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [start, setStart] = useState<Start>('none')
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const busy = creating || uploads.uploading

  useEffect(() => {
    withAuth(teamsApi.listTeams)
      .then((list) => {
        setTeams(list)
        if (list[0]) setTeamId((id) => id || list[0].team_id)
      })
      .catch(() => setTeams([]))
  }, [withAuth])

  async function uploadFiles(id: string, onlyKey?: string) {
    setFormError(null)
    const result = await uploads.upload(id, onlyKey)
    if (!result) return
    if (result.some((item) => item.status !== 'uploaded')) {
      setFormError(result.some((item) => item.status === 'failed')
        ? '작품은 만들었어요. 실패한 파일을 다시 올려 주세요.'
        : '작품은 만들었어요. 남은 파일을 올려 주세요.')
      return
    }
    navigate(projectPath(id, 'manuscripts'), {
      replace: true,
      state: { uploadedIds: result.map((item) => item.manuscriptId) },
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting.current || busy) return
    setFormError(null)
    const t = title.trim()
    if (!t) {
      setTitleError('작품 이름을 입력해 주세요.')
      return
    }
    if (ownerType === 'team' && !teamId) {
      setFormError('팀 작품을 만들 팀을 골라 주세요.')
      return
    }

    submitting.current = true
    setCreating(true)
    try {
      if (createdId) {
        await uploadFiles(createdId)
        return
      }
      const project = await withAuth((token) =>
        projectsApi.createProject(token, { title: t, owner_type: ownerType, team_id: ownerType === 'team' ? teamId : undefined }),
      )
      const id = project.project_id
      setCreatedId(id)
      try {
        if (uploads.items.length) {
          await uploadFiles(id)
          return
        }
        if (start === 'editor') {
          const ms = await withAuth((token) => manuscriptsApi.createManuscript(token, id, { title: '1차 원고', source_type: 'editor' }))
          navigate(projectPath(id, `manuscripts/${ms.manuscript_id}`), { replace: true })
          return
        }
        navigate(projectPath(id), { replace: true })
      } catch (err) {
        // 작품은 만들어졌으니 원고 화면에서 다시 시도하게 안내한다
        navigate(projectPath(id, 'manuscripts'), { replace: true, state: { notice: `작품은 만들었지만 원고를 추가하지 못했어요. ${describeError(err)}` } })
      }
    } catch (err) {
      setFormError(describeError(err))
    } finally {
      setCreating(false)
      submitting.current = false
    }
  }

  const noTeams = teams !== null && teams.length === 0

  return (
    <div className="new-project">
      <header>
        <h1 className="page-title">새 작품</h1>
        <p className="page-desc">어떤 작품을 만드실 건가요?</p>
      </header>

      <form className="panel new-project__form" onSubmit={onSubmit} noValidate>
        <h2 className="panel__title">작품 만들기</h2>

        <fieldset className="new-project__fieldset" disabled={busy || Boolean(createdId)}>
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
              <p className="notice notice--error">소속된 팀이 없어요. 팀에 초대받거나 팀을 만든 뒤 팀 작품을 만들 수 있어요.</p>
            ) : (
              <label className="new-project__team">
                <span className="field__label">소유 팀</span>
                <Select value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={teams === null}>
                  {teams === null && <option>불러오는 중…</option>}
                  {teams?.map((t) => (
                    <option key={t.team_id} value={t.team_id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
        </fieldset>

        <TextField
          label="작품 이름"
          disabled={busy || Boolean(createdId)}
          value={title}
          onChange={(v) => {
            setTitle(v)
            setTitleError(null)
          }}
          error={titleError}
          maxLength={100}
          autoFocus
        />

        <section className="new-project__start" aria-labelledby="start-title">
          <h3 id="start-title" className="new-project__start-title">
            원고 추가 <span>· 선택</span>
          </h3>
          <p className="page-desc">파일마다 원고 하나가 만들어져요.</p>
          <div className="new-project__starts">
            <ManuscriptFilePicker
              items={uploads.items}
              errors={uploads.pickErrors}
              disabled={busy}
              onPick={(files) => {
                uploads.pick(files)
                if (files.some((file) => !validateManuscriptFile(file))) setStart('none')
              }}
              onRemove={uploads.remove}
              onRetry={createdId ? (key) => { void uploadFiles(createdId, key) } : undefined}
            />

            <div className={start === 'editor' ? 'dropzone dropzone--selected' : 'dropzone'}>
              <p className="dropzone__title">빈 편집기로 시작</p>
              <p className="dropzone__hint">편집기 작성본으로 만들어져요</p>
              <Button
                tone="soft"
                aria-pressed={start === 'editor'}
                disabled={busy || Boolean(createdId)}
                onClick={() => {
                  uploads.clear()
                  setStart((s) => s === 'editor' ? 'none' : 'editor')
                }}
              >
                {start === 'editor' ? '선택됨 · 취소' : '편집기 열기'}
              </Button>
            </div>
          </div>
        </section>

        {formError && (
          <p className="notice notice--error" role="alert">
            {formError}
          </p>
        )}
        <Button type="submit" size="xl" block busy={busy} disabled={busy || (ownerType === 'team' && noTeams)}>
          {uploads.uploading ? '원고 올리는 중…' : creating ? '만드는 중…' : createdId ? '남은 파일 다시 올리기' : '작품 시작하기'}
        </Button>
        {createdId && !busy && (
          <Button tone="outline" onClick={() => navigate(projectPath(createdId, 'manuscripts'), {
            replace: true, state: { uploadedIds: uploads.items.filter((item) => item.status === 'uploaded').map((item) => item.manuscriptId) },
          })}>원고 목록으로</Button>
        )}
      </form>
    </div>
  )
}
