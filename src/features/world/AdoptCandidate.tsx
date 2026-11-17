import type { Adoption } from './adoptionModel'
import { useRef, useState, type FormEvent } from 'react'
import { request } from '../../api/client'
import { listChapters } from '../../api/manuscripts'
import { listCharacters } from '../../api/characters'
import { listRelationships } from '../../api/relationships'
import type { NarrativeTrack } from '../../api/types'
import { useSession } from '../../auth/session'
import { useResource } from '../../lib/useResource'
import { describeError } from '../../lib/errors'
import { InsightDialog } from '../insights/InsightDialog'
import { RichText } from '../../components/RichText'
import '../insights/insights.css'
export function AdoptCandidate({
  projectId,
  manuscriptId,
  jobId,
  track,
  index,
  onClose,
  onSaved,
}: {
  projectId: string
  manuscriptId: string
  jobId: string
  track: NarrativeTrack
  index: number
  onClose: () => void
  onSaved: (value: Adoption) => void
}) {
  const relation = track.kind === 'relationship'
  const { withAuth } = useSession()
  const options = useResource(
    async (token) => {
      const [chapters, characters, relationships] = await Promise.all([
        listChapters(token, projectId, manuscriptId),
        listCharacters(token, projectId),
        relation ? listRelationships(token, projectId, manuscriptId) : Promise.resolve([]),
      ])
      return { chapters, characters, relationships }
    },
    [projectId, manuscriptId, relation],
  )
  const [title, setTitle] = useState(track.title.slice(0, 200))
  const [description, setDescription] = useState(track.explanation.slice(0, relation ? 2000 : 5000))
  const [chapterId, setChapterId] = useState(
    [...track.evidence].sort((a, b) => a.chapter_no - b.chapter_no)[0]?.chapter_id ?? '',
  )
  const [payoff, setPayoff] = useState('')
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [state, setState] = useState('')
  const [trust, setTrust] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const existing = options.data?.relationships.find(
    (r) =>
      [r.source_character_id, r.target_character_id].includes(source) &&
      [r.source_character_id, r.target_character_id].includes(target),
  )
  const duplicate = existing?.history.some((h) => h.chapter_id === chapterId)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || duplicate) return
    lock.current = true
    setBusy(true)
    setError(null)
    const body = relation
      ? {
          relationship: {
            source_character_id: source,
            target_character_id: target,
            initial_history: {
              chapter_id: chapterId,
              state: state.trim(),
              trust: trust === '' ? null : Number(trust),
              event_title: description,
            },
          },
          relationship_id: existing?.relationship_id,
        }
      : {
          foreshadowing: {
            title: title.trim(),
            description,
            setup_chapter_id: chapterId,
            linked_character_ids: [],
          },
          payoff_chapter_id: payoff || null,
        }
    try {
      onSaved(
        await withAuth((token) =>
          request<Adoption>('POST', `/projects/${projectId}/conflict-checks/${jobId}/adoptions/${index}`, {
            accessToken: token,
            body,
          }),
        ),
      )
    } catch (e) {
      setError(describeError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const chapters = options.data?.chapters ?? []
  return (
    <InsightDialog title={relation ? '관계 기록으로 등록' : '복선으로 등록'} onClose={onClose} busy={busy}>
      <p>AI가 추론한 후보예요. 원문과 대조하고, 작품에서 확정할 내용만 등록해 주세요.</p>
      <RichText>{track.explanation}</RichText>
      {options.loading && <p role="status">장과 인물 목록을 불러오고 있어요.</p>}
      {(options.error || error) && <p role="alert">{error ?? options.error}</p>}
      <form className="writer-form" onSubmit={submit}>
        {relation ? (
          <>
            <label>
              첫 번째 인물
              <select required value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">인물 선택</option>
                {options.data?.characters.map((c) => (
                  <option key={c.character_id} value={c.character_id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              두 번째 인물
              <select required value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">인물 선택</option>
                {options.data?.characters
                  .filter((c) => c.character_id !== source)
                  .map((c) => (
                    <option key={c.character_id} value={c.character_id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              관계 상태
              <input
                required
                maxLength={50}
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="예: 동맹, 갈등, 신뢰 회복"
              />
            </label>
            <label>
              신뢰도 (선택, 0~100)
              <input
                type="number"
                min={0}
                max={100}
                value={trust}
                onChange={(e) => setTrust(e.target.value)}
              />
            </label>
            {existing && <p>기존 관계에 이 장의 변화 기록을 추가합니다.</p>}
            {duplicate && (
              <p role="alert">이 장에는 이미 관계 기록이 있어요. 관계 화면에서 기존 기록을 검토해 주세요.</p>
            )}
          </>
        ) : (
          <label>
            복선 제목
            <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
        )}
        <label>
          {relation ? '변화가 일어난 장' : '복선을 심은 장'}
          <select required value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
            <option value="">장 선택</option>
            {chapters.map((c) => (
              <option key={c.chapter_id} value={c.chapter_id}>
                {c.chapter_no}장 {c.title}
              </option>
            ))}
          </select>
        </label>
        {!relation && (
          <label>
            회수한 장 (선택)
            <select value={payoff} onChange={(e) => setPayoff(e.target.value)}>
              <option value="">아직 회수하지 않음</option>
              {chapters
                .filter(
                  (c) =>
                    c.chapter_no >= (chapters.find((item) => item.chapter_id === chapterId)?.chapter_no ?? 0),
                )
                .map((c) => (
                  <option key={c.chapter_id} value={c.chapter_id}>
                    {c.chapter_no}장 {c.title}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          기록할 설명
          <textarea
            rows={5}
            maxLength={relation ? 2000 : 5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="writer-actions">
          <button type="button" className="btn btn--outline" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn--primary"
            disabled={
              busy || options.loading || !!options.error || duplicate || (relation && source === target)
            }
          >
            {busy ? '등록 중…' : '확인하고 등록'}
          </button>
        </div>
      </form>
    </InsightDialog>
  )
}
