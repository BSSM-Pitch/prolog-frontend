import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as api from '../../api/characters'
import type { Character, CharacterAttribute, CharacterCategory } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { describeError } from '../../lib/errors'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import { CATEGORIES } from './shared'
import './characters.css'

const PLACEHOLDER: Record<CharacterCategory, string> = {
  personality_tags: '예: 신중함',
  core_values: '예: 약속 중시',
  influence_relations: '예: 재현',
  emotion_keywords: '예: 불안',
}

// 추출을 거치지 않고 확정된 인물의 태그·가치관·영향 관계·감정 키워드를 바로 고친다
export function CharacterEditPage() {
  const project = useProject()
  const { characterId = '' } = useParams()
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const resource = useResource(project ? (t) => api.listCharacters(t, projectId) : null, [projectId])
  const [error, setError] = useState<{ field: CharacterCategory | null; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!project) return <p className="page-desc">작품을 불러오고 있어요</p>
  const character = resource.data?.find((c) => c.character_id === characterId)
  const canEdit = project.my_role !== 'viewer'
  const backTo = `${projectPath(projectId, 'characters')}?selected=${characterId}`

  /** 서버 호출 한 건. 성공하면 화면 데이터를 바꾸고, 실패하면 이유를 보여 준다 */
  async function run<T>(field: CharacterCategory, job: (token: string) => Promise<T>, apply: (attrs: CharacterAttribute[], result: T) => CharacterAttribute[]) {
    setBusy(true)
    setError(null)
    try {
      const result = await withAuth(job)
      resource.setData((prev) =>
        prev
          ? prev.map((c) => (c.character_id === characterId ? withAttributes(c, apply(c.attributes ?? [], result)) : c))
          : prev,
      )
      return true
    } catch (e) {
      setError({ field, message: describeError(e) })
      return false
    } finally {
      setBusy(false)
    }
  }

  const add = (field: CharacterCategory, value: string) =>
    run(
      field,
      (t) => api.addCharacterAttribute(t, projectId, characterId, { field, value }),
      (attrs, created) => [...attrs, created],
    )
  const edit = (attr: CharacterAttribute, value: string) =>
    run(
      attr.field,
      (t) => api.updateCharacterAttribute(t, projectId, characterId, attr.attribute_id, { value }),
      (attrs, updated) => attrs.map((a) => (a.attribute_id === attr.attribute_id ? updated : a)),
    )
  const remove = (attr: CharacterAttribute) =>
    run(
      attr.field,
      (t) => api.deleteCharacterAttribute(t, projectId, characterId, attr.attribute_id),
      (attrs) => attrs.filter((a) => a.attribute_id !== attr.attribute_id),
    )

  return (
    <div className="nl-design char-edit">
      <header>
        <p className="page-crumb">등장인물 / {character?.name ?? '인물'} 수정</p>
        <h1 className="page-title">{character ? `${character.name} 직접 수정` : '인물 직접 수정'}</h1>
        <p className="page-desc">문장을 쓰거나 추출하지 않고 기존 내용에서 바로 고쳐요. 바꾸면 곧바로 저장돼요.</p>
      </header>

      {resource.loading && !character && <p className="page-desc">인물을 불러오고 있어요</p>}
      {resource.error && !character && (
        <div role="alert">
          <p className="notice notice--error">{resource.error}</p>
          <Button tone="outline" onClick={resource.reload}>
            다시 시도
          </Button>
        </div>
      )}
      {resource.data && !character && <p className="notice notice--error">이 인물을 찾을 수 없어요. 삭제됐을 수 있어요.</p>}
      {!canEdit && character && <p className="notice notice--error">보기 권한만 있어서 수정할 수 없어요.</p>}

      {character &&
        CATEGORIES.map((c) => (
          <AttributeSection
            key={c.field}
            label={c.label}
            field={c.field}
            attrs={(character.attributes ?? []).filter((a) => a.field === c.field)}
            canEdit={canEdit}
            busy={busy}
            error={error?.field === c.field ? error.message : null}
            onAdd={add}
            onEdit={edit}
            onRemove={remove}
          />
        ))}

      <div className="actions-row">
        <Link className="btn btn--primary" to={backTo}>
          완료
        </Link>
        {canEdit && (
          <Link className="btn btn--outline" to={`${projectPath(projectId, 'characters/new')}?target=${characterId}`}>
            문장으로 더 추가하기
          </Link>
        )}
      </div>
    </div>
  )
}

function withAttributes(c: Character, attributes: CharacterAttribute[]): Character {
  const by = (field: CharacterCategory) => attributes.filter((a) => a.field === field).map((a) => a.value)
  return {
    ...c,
    attributes,
    personality_tags: by('personality_tags'),
    core_values: by('core_values'),
    emotion_keywords: by('emotion_keywords'),
  }
}

interface SectionProps {
  label: string
  field: CharacterCategory
  attrs: CharacterAttribute[]
  canEdit: boolean
  busy: boolean
  error: string | null
  onAdd: (field: CharacterCategory, value: string) => Promise<boolean>
  onEdit: (attr: CharacterAttribute, value: string) => Promise<boolean>
  onRemove: (attr: CharacterAttribute) => Promise<boolean>
}

function AttributeSection({ label, field, attrs, canEdit, busy, error, onAdd, onEdit, onRemove }: SectionProps) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  async function submitAdd(e: FormEvent) {
    e.preventDefault()
    const value = draft.trim()
    if (!value) return
    if (await onAdd(field, value)) setDraft('')
  }

  async function submitEdit(e: FormEvent, attr: CharacterAttribute) {
    e.preventDefault()
    const value = editValue.trim()
    if (!value || value === attr.value) return setEditingId(null)
    if (await onEdit(attr, value)) setEditingId(null)
  }

  return (
    <section className="panel" aria-label={label}>
      <h2 className="panel__title">{label}</h2>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {attrs.length === 0 && <p className="panel__label">아직 없어요. 아래에서 바로 추가할 수 있어요.</p>}
      <ul className="char-edit__list">
        {attrs.map((a) => (
          <li key={a.attribute_id} className="char-edit__row">
            {editingId === a.attribute_id ? (
              <form className="char-edit__form" onSubmit={(e) => submitEdit(e, a)}>
                <TextField label={`${label} 고치기`} value={editValue} onChange={setEditValue} autoFocus />
                <Button type="submit" busy={busy}>
                  저장
                </Button>
                <Button tone="outline" onClick={() => setEditingId(null)}>
                  취소
                </Button>
              </form>
            ) : (
              <>
                <span className="chip">{a.value}</span>
                {a.origin === 'ai_extracted' && <span className="badge badge--outline">AI 추출</span>}
                {canEdit && (
                  <span className="char-edit__actions">
                    <Button
                      tone="outline"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(a.attribute_id)
                        setEditValue(a.value)
                      }}
                    >
                      수정
                    </Button>
                    <Button tone="error" disabled={busy} onClick={() => onRemove(a)}>
                      삭제
                    </Button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form className="char-edit__form" onSubmit={submitAdd}>
          <TextField label={`${label} 추가`} value={draft} onChange={setDraft} placeholder={PLACEHOLDER[field]} />
          <Button type="submit" busy={busy} disabled={!draft.trim()}>
            추가
          </Button>
        </form>
      )}
    </section>
  )
}
