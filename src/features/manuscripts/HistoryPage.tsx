import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import * as api from '../../api/manuscripts'
import type { ManuscriptVersion, VersionReason } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { formatCount } from '../../lib/format'
import { formatStamp } from '../../lib/relativeTime'
import { useResource } from '../../lib/useResource'
import { projectPath, useProject } from '../app/currentProject'
import '../characters/characters.css'
import '../world/world.css'
import './HistoryPage.css'

const TITLE: Record<VersionReason, string> = { edit: '문단 직접 수정', autosave: '자동 저장', file_upload: '파일 업로드', import: '원고 불러옴' }
const SOURCE: Record<VersionReason, string> = { edit: '편집기에서 직접 수정', autosave: '편집 중 자동 저장', file_upload: '파일에서 불러옴', import: '이전 원고에서 불러옴' }

const titleOf = (v: ManuscriptVersion) => v.label ?? TITLE[v.reason]

// Figma 1261:3042 · 32 원고 편집 이력
export function HistoryPage() {
  // 다른 원고로 옮기면 더 불러온 목록을 버리고 처음부터 보여 준다
  const { projectId = '', manuscriptId = '' } = useParams()
  return <History key={`${projectId}/${manuscriptId}`} />
}

function History() {
  const project = useProject()
  const { manuscriptId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { withAuth } = useSession()
  const projectId = project?.project_id ?? ''

  const manuscript = useResource(project ? (t) => api.getManuscript(t, projectId, manuscriptId) : null, [projectId, manuscriptId])
  const first = useResource(project ? (t) => api.listVersions(t, projectId, manuscriptId) : null, [projectId, manuscriptId])
  const [more, setMore] = useState<{ items: ManuscriptVersion[]; cursor: string | null } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  const items = [...(first.data?.data ?? []), ...(more?.items ?? [])]
  const cursor = more ? more.cursor : (first.data?.meta.next_cursor ?? null)
  const total = first.data?.meta.total ?? items.length
  const selected = items.find((v) => v.version_id === params.get('version')) ?? items[0] ?? null
  const detail = useResource(selected ? (t) => api.getVersion(t, projectId, manuscriptId, selected.version_id) : null, [projectId, manuscriptId, selected?.version_id])
  const shown = detail.data?.version_id === selected?.version_id ? detail.data : null

  // 선택한 스냅샷이 바뀌면 본문을 맨 위부터 보여 준다
  useEffect(() => {
    document.querySelector('.history__text')?.scrollTo({ top: 0 })
  }, [selected?.version_id])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const next = await withAuth((t) => api.listVersions(t, projectId, manuscriptId, cursor))
      setMore((prev) => ({ items: [...(prev?.items ?? []), ...next.data], cursor: next.meta.next_cursor }))
    } catch (e) {
      setMoreError(describeError(e))
    } finally {
      setLoadingMore(false)
    }
  }

  if (!project) return <p className="page-desc">프로젝트를 불러오고 있어요</p>
  const ms = manuscript.data
  const editorPath = projectPath(projectId, `manuscripts/${manuscriptId}`)
  const loadError = manuscript.error ?? first.error

  return (
    <div className="history">
      <header className="world__header">
        <div>
          <p className="page-crumb">
            쓰기 / {project.title}
            {ms ? ` / ${ms.title}` : ''}
          </p>
          <h1 className="page-title">편집 이력</h1>
          <p className="page-desc">자동 저장된 원고 스냅샷을 시간순으로 확인하세요.</p>
        </div>
        <Link className="btn btn--outline" to={editorPath}>
          편집기로 돌아가기
        </Link>
      </header>

      {loadError && !first.data && (
        <div className="panel" role="alert">
          <p className="panel__title">편집 이력을 불러오지 못했어요</p>
          <p className="page-desc">{loadError}</p>
          <Button tone="outline" onClick={first.reload}>
            다시 시도
          </Button>
        </div>
      )}

      {first.data && items.length === 0 && (
        <div className="state-block">
          <p className="panel__title">아직 남은 스냅샷이 없어요</p>
          <p className="page-desc">편집기에서 글을 고치면 자동 저장될 때마다 이곳에 기록돼요.</p>
          <Link className="btn btn--primary" to={editorPath}>
            편집기에서 쓰기
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="history__layout">
          <section className="panel" aria-labelledby="snapshots-title">
            <h2 id="snapshots-title" className="panel__title">
              스냅샷 {total}개
            </h2>
            <ol className="char-list history__list">
              {items.map((v) => {
                const current = v.version_id === selected?.version_id
                return (
                  <li key={v.version_id}>
                    <button type="button" className="char-item history__item" aria-current={current || undefined} onClick={() => setParams({ version: v.version_id }, { replace: true })}>
                      <span className="char-item__meta">{formatStamp(v.created_at)}</span>
                      <span className="history__item-title">
                        {titleOf(v)}
                        {current ? (
                          <span className="badge badge--done">보는 중</span>
                        ) : (
                          v.reason === 'file_upload' && <span className="badge badge--filled">파일 업로드</span>
                        )}
                      </span>
                      <span className="char-item__meta">
                        {v.chapter_no}장{v.chapter_title && v.chapter_title !== `${v.chapter_no}장` ? ` · ${v.chapter_title}` : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
            {moreError && <p className="notice notice--error">{moreError}</p>}
            {cursor && (
              <Button tone="soft" onClick={loadMore} busy={loadingMore}>
                이전 스냅샷 더 보기
              </Button>
            )}
          </section>

          {selected && (
            <section className="panel history__detail" aria-labelledby="snapshot-title">
              <div className="world__list-head">
                <h2 id="snapshot-title" className="panel__title">
                  {formatStamp(selected.created_at)} 스냅샷
                </h2>
                <Link className="btn btn--secondary" to={`${editorPath}?chapter=${selected.chapter_no}`}>
                  편집기에서 {selected.chapter_no}장 열기
                </Link>
              </div>
              <div className="history__meta">
                <span className="badge badge--filled">{formatCount(selected.char_count)}자</span>
                <span className="badge badge--filled">{selected.chapter_no}장</span>
                <span className="badge badge--filled">{SOURCE[selected.reason]}</span>
              </div>
              {detail.error && !shown ? (
                <p className="notice notice--error">{detail.error}</p>
              ) : (
                <div className="history__text" aria-busy={!shown}>
                  {shown ? shown.content || <span className="panel__label">비어 있는 장이에요.</span> : <span className="panel__label">본문을 불러오고 있어요</span>}
                </div>
              )}
              <p className="panel__label">스냅샷은 읽기 전용이에요. 지금 원고는 바뀌지 않아요.</p>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
