import { useState } from 'react'
import * as api from '../../api/characterMemory'
import type { DiscoveredCharacter, MemoryJob } from '../../api/characterMemory'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { describeError } from '../../lib/errors'
import { discoverySummary, uniqueCandidates } from './discoveryModel'

export type PersonOption = { character_id: string; name: string }

export function CharacterDiscovery({
  projectId,
  manuscriptId,
  job,
  characters,
  canEdit,
  onChange,
}: {
  projectId: string
  manuscriptId: string
  job: MemoryJob
  characters: PersonOption[]
  canEdit: boolean
  onChange: () => void
}) {
  const report = job.discovery
  if (!report) return null
  const summary = discoverySummary(report.candidates)
  const registered = uniqueCandidates(report.candidates).filter(
    (c) => c.status === 'added' || c.status === 'existing' || c.status === 'confirmed',
  )
  return (
    <section className="discovery-result" aria-label="원고에서 찾은 인물">
      <h4>원고에서 찾은 인물</h4>
      {report.complete ? (
        <p role="status">
          새 인물 {summary.added}명 자동 추가 · 기존 인물 {summary.existing}명 확인 · 검토할 이름{' '}
          {summary.review.length}개
        </p>
      ) : (
        <p role="status">
          이름과 근거를 찾는 중 · {report.processed_chunks} / {report.total_chunks}구간
        </p>
      )}
      {report.complete && report.candidates.length === 0 && (
        <p>자동으로 등록할 이름을 찾지 못했어요. 이름 없는 화자나 호칭만 나오는 인물은 직접 추가할 수 있어요.</p>
      )}
      {report.complete && registered.length > 0 && (
        <details>
          <summary>등록된 이름과 원문 근거 보기</summary>
          {registered.map((candidate) => (
            <article className="discovery-candidate" key={candidate.candidate_id}>
              <strong>{candidate.name}</strong>
              <span className="panel__label">
                {' '}
                ·{' '}
                {candidate.status === 'added'
                  ? '자동 추가'
                  : candidate.status === 'confirmed'
                    ? '작가 확인'
                    : '기존 인물'}
              </span>
              <blockquote>{candidate.evidence.quote}</blockquote>
            </article>
          ))}
        </details>
      )}
      {report.complete && summary.review.length > 0 && (
        <details>
          <summary>동일인 여부가 불분명한 이름 확인하기 ({summary.review.length})</summary>
          <p>
            근거를 확인해 새 인물로 추가하거나 기존 인물의 별칭으로 연결하세요. 반영한 뒤 원고를 다시 분석하면 기록에도
            적용됩니다.
          </p>
          {summary.review.map((candidate) => (
            <ReviewCandidate
              key={candidate.candidate_id}
              {...{ projectId, manuscriptId, candidate, characters, canEdit, onChange }}
              analysisId={job.analysis_id}
              working={job.status === 'queued' || job.status === 'running'}
            />
          ))}
        </details>
      )}
    </section>
  )
}

function ReviewCandidate({
  projectId,
  manuscriptId,
  analysisId,
  candidate,
  characters,
  canEdit,
  working,
  onChange,
}: {
  projectId: string
  manuscriptId: string
  analysisId: string
  candidate: DiscoveredCharacter
  characters: PersonOption[]
  canEdit: boolean
  working: boolean
  onChange: () => void
}) {
  const { withAuth } = useSession()
  const [target, setTarget] = useState('')
  const [name, setName] = useState(candidate.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function resolve(action: 'create' | 'link' | 'dismiss') {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await withAuth((t) =>
        api.resolveCandidate(
          t,
          projectId,
          manuscriptId,
          analysisId,
          candidate.candidate_id,
          action,
          target || undefined,
          action === 'create' ? name.trim() : undefined,
        ),
      )
      onChange()
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <article className="discovery-candidate">
      <strong>{candidate.name}</strong>
      {candidate.alias_of && <span className="panel__label"> · {candidate.alias_of}의 다른 표기일 수 있어요</span>}
      <p>{candidate.reason}</p>
      <blockquote>{candidate.evidence.quote}</blockquote>
      {canEdit &&
        (working ? (
          <p>디테일 분석이 끝난 뒤 연결할 수 있어요.</p>
        ) : (
          <>
            <label className="field">
              <span className="field__label">연결할 기존 인물</span>
              <Select
                aria-label={`${candidate.name} 연결할 인물`}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">인물 선택</option>
                {characters.map((c) => (
                  <option key={c.character_id} value={c.character_id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field">
              <span className="field__label">새 인물로 등록할 이름</span>
              <input
                aria-label={`${candidate.name} 등록할 이름`}
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="actions-row">
              <Button tone="outline" disabled={busy || !target} busy={busy} onClick={() => resolve('link')}>
                별칭으로 연결
              </Button>
              <Button tone="outline" disabled={busy || !name.trim()} onClick={() => resolve('create')}>
                새 인물로 추가
              </Button>
              <Button tone="outline" disabled={busy} onClick={() => resolve('dismiss')}>
                제외
              </Button>
            </div>
          </>
        ))}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}
