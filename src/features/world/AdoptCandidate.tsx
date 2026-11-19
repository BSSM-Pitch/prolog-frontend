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
import { Select } from '../../components/Select'
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
  const duplicate = existing?.history.find((h) => h.chapter_id === chapterId)
  const [accepted, setAccepted] = useState<string | null>(null)
  const comparison = JSON.stringify([
    existing?.relationship_id,
    chapterId,
    duplicate?.source_review?.revision_token,
    state,
    trust,
    description,
  ])
  const confirmed = accepted === comparison
  // 선택 상자는 버튼이라 required로 막을 수 없어 직접 확인한다
  const missing = !chapterId || (relation && (!source || !target))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || (duplicate && !confirmed) || missing) return
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
          replace_existing: !!duplicate,
          expected_history_token: duplicate?.source_review?.revision_token,
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
      setAccepted(null)
      options.reload()
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
      {options.loading && <p className="panel__label" role="status">장과 인물 목록을 불러오고 있어요.</p>}
      {(options.error || error) && <p className="notice notice--error" role="alert">{error ?? options.error}</p>}
      <form className="writer-form" onSubmit={submit}>
        {relation ? (
          <>
            <label>
              첫 번째 인물
              <Select
                aria-label="첫 번째 인물"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">인물 선택</option>
                {options.data?.characters.map((c) => (
                  <option key={c.character_id} value={c.character_id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              두 번째 인물
              <Select
                aria-label="두 번째 인물"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">인물 선택</option>
                {options.data?.characters
                  .filter((c) => c.character_id !== source)
                  .map((c) => (
                    <option key={c.character_id} value={c.character_id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
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
            {existing && !duplicate && <p>기존 관계에 이 장의 변화 기록을 추가합니다.</p>}
            {duplicate && (
              <section className="evidence-box" aria-label="기존 관계 기록 비교">
                <strong>{duplicate.chapter}장에 저장된 기록</strong>
                <p>
                  상태: {duplicate.state} · 신뢰도: {duplicate.trust ?? '미지정'}
                </p>
                <RichText>{duplicate.event_title ?? '설명 없음'}</RichText>
                <p>아래 설명과 위의 관계 상태를 비교해 주세요. 기존 기록을 교체하려면 확인이 필요해요.</p>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={busy || !duplicate.source_review?.revision_token}
                    onChange={(e) => setAccepted(e.target.checked ? comparison : null)}
                  />
                  기존 기록과 비교했고 입력한 내용으로 바꿉니다
                </label>
              </section>
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
          <Select
            aria-label={relation ? '변화가 일어난 장' : '복선을 심은 장'}
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
          >
            <option value="">장 선택</option>
            {chapters.map((c) => (
              <option key={c.chapter_id} value={c.chapter_id}>
                {c.chapter_no}장 {c.title}
              </option>
            ))}
          </Select>
        </label>
        {!relation && (
          <label>
            회수한 장 (선택)
            <Select aria-label="회수한 장 (선택)" value={payoff} onChange={(e) => setPayoff(e.target.value)}>
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
            </Select>
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
        <div className="dialog__actions">
          <button type="button" className="btn btn--outline" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn--primary"
            disabled={
              busy ||
              options.loading ||
              !!options.error ||
              (!!duplicate && !confirmed) ||
              missing ||
              (relation && source === target)
            }
          >
            {busy ? '저장 중…' : duplicate ? '비교한 기록으로 교체' : '확인하고 등록'}
          </button>
        </div>
      </form>
    </InsightDialog>
  )
}
