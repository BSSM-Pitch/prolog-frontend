import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import * as api from '../../api/characters'
import { ApiError } from '../../api/client'
import type { Character } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { describeError } from '../../lib/errors'
import { josa } from '../../lib/josa'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import './characters.css'

const PAGE = 6

interface Dependent {
  relationship_id: string
  other: string
  latest_state: string
  history_count: number
}

// Figma 842:863 · 20 등장인물
export function CharactersPage() {
  const project = useProject()
  const navigate = useNavigate()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [params, setParams] = useSearchParams()
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const list = useResource(project ? (t) => api.listCharacters(t, projectId) : null, [projectId])
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [confirm, setConfirm] = useState<Character | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [blocked, setBlocked] = useState<{ message: string; deps: Dependent[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>

  const all = list.data ?? []
  const filtered = all.filter((c) => !query.trim() || c.name.includes(query.trim()))
  const selected = all.find((c) => c.character_id === params.get('selected')) ?? filtered[0] ?? null
  const canEdit = project.my_role !== 'viewer'

  async function remove(c: Character) {
    setDeleting(true)
    setError(null)
    try {
      await withAuth((t) => api.deleteCharacter(t, projectId, c.character_id))
      list.setData((prev) => prev?.filter((x) => x.character_id !== c.character_id) ?? null)
      setParams({}, { replace: true })
      setConfirm(null)
    } catch (e) {
      setConfirm(null)
      if (e instanceof ApiError && e.code === 'CHARACTER_HAS_DEPENDENT_RELATIONSHIPS') {
        setBlocked({ message: e.message, deps: (e.details.relationships as Dependent[]) ?? [] })
      } else setError(describeError(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="characters">
      <header>
        <p className="page-crumb">세계관 데이터 / 등장인물 {all.length}명</p>
        <h1 className="page-title">등장인물</h1>
        <p className="page-desc">선택한 인물의 정보와 변화 이력, 연결 관계를 관리하세요.</p>
      </header>
      {notice && (
        <p className="notice notice--success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      <div className="two-col two-col--list">
        <section className="panel" aria-labelledby="char-list-title">
          <h2 id="char-list-title" className="panel__title">
            등장인물 {all.length}명
          </h2>
          <label className="field">
            <span className="field__label">인물 검색</span>
            <input className="char-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름으로 검색" />
          </label>
          {list.loading && !list.data && <p className="panel__label">인물을 불러오고 있어요</p>}
          {list.error && !list.data && (
            <div role="alert">
              <p className="notice notice--error">{list.error}</p>
              <Button tone="outline" onClick={list.reload}>
                다시 시도
              </Button>
            </div>
          )}
          {list.data && filtered.length === 0 && (
            <p className="panel__label">{all.length === 0 ? '아직 등록한 인물이 없어요. 문장으로 인물을 설명해 첫 인물을 만들어 보세요.' : '검색한 이름의 인물이 없어요.'}</p>
          )}
          <ul className="char-list">
            {filtered.slice(0, shown).map((c) => (
              <li key={c.character_id}>
                <button
                  type="button"
                  className="char-item"
                  aria-current={selected?.character_id === c.character_id || undefined}
                  onClick={() => setParams({ selected: c.character_id }, { replace: true })}
                >
                  <span className="char-item__name">{c.name}</span>
                  <span className="char-item__meta">
                    {c.role_label} · {c.status_label} / 마지막 등장 {c.last_chapter ? `${c.last_chapter}장` : '—'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {filtered.length > shown && (
            <button type="button" className="projects__more" onClick={() => setShown((n) => n + PAGE)}>
              더 보기
            </button>
          )}
          {canEdit && (
            <Link className="btn btn--primary btn--block" to={projectPath(projectId, 'characters/new')}>
              + 새 인물 추가
            </Link>
          )}
        </section>

        {selected ? (
          <section className="panel" aria-labelledby="char-detail-title">
            <h2 id="char-detail-title" className="page-title">
              {selected.name}
            </h2>
            <p className="panel__label">
              {selected.role_label} · {selected.status_label}
            </p>
            <div className="char-detail__grid">
              <AttrBox label="성격 태그" values={selected.personality_tags} />
              <AttrBox label="핵심 가치" values={selected.core_values} />
              <AttrBox
                label="영향 관계"
                values={selected.influence_relations.map((r) => [r.target, r.type, r.status].filter(Boolean).join(' · '))}
              />
              <AttrBox label="감정 키워드" values={selected.emotion_keywords} />
            </div>
            <div>
              <p className="panel__label">연결 관계</p>
              <p className="char-detail__links">
                <span className="char-detail__count">{selected.relationship_count}건</span>
                <span className="panel__label">확정된 연결</span>
              </p>
            </div>
            <div>
              <p className="panel__label">주요 변화</p>
              {selected.key_changes.length > 0 ? (
                <ul className="changes">
                  {selected.key_changes.map((ch) => (
                    <li key={`${ch.chapter}-${ch.text}`}>
                      <strong>{ch.chapter}장</strong> {ch.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel__label">기록된 관계 변화가 없어요.</p>
              )}
            </div>
            <div className="actions-row">
              {canEdit && (
                <Link className="btn btn--outline" to={`${projectPath(projectId, 'characters/new')}?target=${selected.character_id}`}>
                  인물 수정
                </Link>
              )}
              <Link className="btn btn--outline" to={`${projectPath(projectId, 'relationships')}?character=${selected.character_id}`}>
                관계 보기
              </Link>
              {canEdit && (
                <Button tone="error" onClick={() => setConfirm(selected)}>
                  인물 삭제
                </Button>
              )}
            </div>
          </section>
        ) : (
          list.data && (
            <section className="panel">
              <p className="panel__title">인물을 선택하세요</p>
              <p className="page-desc">왼쪽 목록에서 인물을 고르면 정보와 관계 변화가 여기에 표시돼요.</p>
            </section>
          )
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title={`${josa(confirm.name, '을/를')} 삭제할까요?`}
          body="인물의 성격·가치관·관계 정보가 사라지고 되돌릴 수 없어요. 원고 본문은 바뀌지 않아요."
          confirmLabel="삭제"
          busy={deleting}
          onConfirm={() => remove(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {blocked && (
        <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setBlocked(null)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="blocked-title" onKeyDown={(e) => e.key === 'Escape' && setBlocked(null)}>
            <h2 id="blocked-title" className="panel__title">
              관계가 남아 있는 인물이에요
            </h2>
            <p className="page-desc">{blocked.message}</p>
            <ul className="changes">
              {blocked.deps.map((d) => (
                <li key={d.relationship_id}>
                  {selected?.name} ↔ {d.other} · {d.latest_state} · 기록 {d.history_count}개
                </li>
              ))}
            </ul>
            <div className="dialog__actions">
              <Button tone="outline" onClick={() => setBlocked(null)} autoFocus>
                닫기
              </Button>
              <Button onClick={() => navigate(`${projectPath(projectId, 'relationships')}?character=${selected?.character_id ?? ''}`)}>관계 변화로 이동</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AttrBox({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="attr-box">
      <p className="panel__label">{label}</p>
      {values.length > 0 ? (
        <div className="chips">
          {values.map((v) => (
            <span key={v} className="chip">
              {v}
            </span>
          ))}
        </div>
      ) : (
        <p className="panel__label">없음</p>
      )}
    </div>
  )
}
