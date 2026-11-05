import { useState } from 'react'
import { IconArrowUpRight, IconChevronDown } from '@tabler/icons-react'
import {
  buildAssessment,
  getAssessment,
  type CharacterAxisScore,
  type CharacterRubric,
} from '../../api/characterAssessment'
import type { CharacterDetails } from '../../api/characterMemory'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { useInterval, useResource } from '../../lib/useResource'
import './assessment.css'

export function CharacterAssessment({
  projectId,
  manuscriptId,
  characterId,
  order,
  data,
  canEdit,
  onEvidence,
  onRefresh,
}: {
  projectId: string
  manuscriptId: string
  characterId: string
  order: string
  data: CharacterDetails
  canEdit: boolean
  onEvidence: (ids: string[]) => void
  onRefresh: () => void
}) {
  const state = useResource(
    (t) => getAssessment(t, projectId, manuscriptId, characterId, order),
    [projectId, manuscriptId, characterId, order, data.analysis_id],
  )
  const { withAuth } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const sourceChanged = state.data && state.data.memory_analysis_id !== data.analysis_id
  const job = sourceChanged ? null : state.data?.job
  const working = job?.status === 'queued' || job?.status === 'running'
  useInterval(state.reload, 4000, working)
  async function evaluate() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await withAuth((t) => buildAssessment(t, projectId, manuscriptId, characterId, order))
      state.reload()
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }
  const result = job?.result
  const unverified = result?.axes.filter((axis) => axis.status === 'unverified_evidence').length ?? 0
  const byId = new Map(data.observations.map((r) => [r.observation_id, r]))
  const sceneTitles = new Map(data.observations.map((r) => [r.evidence.scene_id, r.scene_title]))
  const shown = result?.axes.find((axis) => axis.axis_id === expanded)
  return (
    <section className="character-assessment" aria-labelledby="assessment-heading">
      <div className="assessment-heading">
        <div>
          <p className="detail-eyebrow">성향 · 판단력 · 역량</p>
          <h3 id="assessment-heading">이 인물은 어떤 사람인가</h3>
        </div>
        <span>공통 행동 기준 · 5단계</span>
      </div>
      <p className="assessment-intro">
        원문에서 드러난 선택과 수행을 기준으로 평가합니다. 장면마다 달라지는 모습과 반대 근거까지 함께 살펴보세요.
      </p>
      {(error || state.error) && (
        <div className="notice notice--error" role="alert">
          {error || state.error}
          <Button tone="outline" onClick={state.reload}>
            다시 불러오기
          </Button>
        </div>
      )}
      {!state.data && !state.error && <p role="status">인물 평가를 불러오고 있어요.</p>}
      {sourceChanged && (
        <div className="notice" role="status">
          인물 기억이 갱신됐어요. 최신 원문 기록을 불러오면 평가를 확인할 수 있어요.
          <Button tone="outline" onClick={onRefresh}>
            최신 인물 기록 불러오기
          </Button>
        </div>
      )}
      {working && (
        <div className="memory-progress" role="status">
          <span className="memory-pulse" />
          <div>
            <strong>
              {job?.status === 'queued' ? '인물 평가를 기다리고 있어요' : '평가 기준과 원문을 대조하고 있어요'}
            </strong>
            <p>초안을 작성한 뒤 반례와 판단 근거를 다시 검토합니다. 몇 분 걸릴 수 있어요.</p>
          </div>
        </div>
      )}
      {job?.status === 'failed' && (
        <p className="notice notice--error" role="alert">
          {job.error}
        </p>
      )}
      {!result && state.data && !sourceChanged && (
        <>
          <div className="assessment-rubrics">
            {state.data.rubric.map((r) => (
              <div key={r.id}>
                <span>{r.group}</span>
                <strong>{r.label}</strong>
                <p>{r.question}</p>
              </div>
            ))}
          </div>
          {!working && (
            <div className="assessment-start">
              <p>
                {state.data.stale
                  ? '원고가 변경됐어요. 인물 기록을 갱신하면 현재 원고를 평가할 수 있어요.'
                  : '각 항목에 서로 다른 원고 구간 3개 이상의 근거가 있어야 점수를 표시합니다.'}
              </p>
              {canEdit && !state.data.stale ? (
                <Button busy={busy} disabled={busy} onClick={evaluate}>
                  {job?.status === 'failed' ? '인물 평가 다시 시도' : '원문으로 인물 평가하기'}
                </Button>
              ) : (
                !canEdit && <small>작품 편집자가 평가를 시작할 수 있어요.</small>
              )}
            </div>
          )}
        </>
      )}
      {result && (
        <>
          {unverified > 0 && (
            <div className="notice" role="status">
              {unverified}개 항목은 원문 근거 검증을 통과하지 못해 점수를 보류했어요.
              {canEdit && !state.data?.stale && (
                <Button tone="outline" busy={busy} disabled={busy} onClick={evaluate}>
                  인물 평가 다시 검토
                </Button>
              )}
            </div>
          )}
          <div className="assessment-score-grid">
            {result.axes.map((axis) => (
              <button
                type="button"
                key={axis.axis_id}
                className="assessment-score"
                aria-expanded={expanded === axis.axis_id}
                aria-controls="assessment-axis-detail"
                onClick={() => setExpanded(expanded === axis.axis_id ? null : axis.axis_id)}
              >
                <span>
                  {axis.rubric.group}
                  <IconArrowUpRight size={15} />
                </span>
                <h4>{axis.rubric.label}</h4>
                <div className="assessment-value">
                  {axis.score === null ? (
                    <strong className="assessment-unrated">
                      {axis.status === 'unverified_evidence' ? '근거 확인 필요' : '판단 보류'}
                    </strong>
                  ) : (
                    <>
                      <strong>{axis.score.toFixed(1)}</strong>
                      <span>/ 5</span>
                    </>
                  )}
                </div>
                <div className="assessment-scale" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((step) => (
                    <i key={step}>
                      <b style={{ width: `${Math.max(0, Math.min(1, (axis.score ?? 0) - step)) * 100}%` }} />
                    </i>
                  ))}
                </div>
                <p>{axis.verdict}</p>
                <small>
                  평가 근거 {axis.rated_scenes}개 구간 · 반례 {axis.counterevidence_ids.length}건
                </small>
              </button>
            ))}
          </div>
          {shown && (
            <div className="assessment-axis-detail" id="assessment-axis-detail">
              <div className="assessment-heading">
                <h4>{shown.rubric.label} · 평가 근거</h4>
                <button type="button" onClick={() => setExpanded(null)}>
                  접기 ×
                </button>
              </div>
              <p className="assessment-verdict">{shown.verdict}</p>
              <p>
                <strong>성립하는 조건</strong> {shown.conditions}
              </p>
              <p>
                <strong>판단의 한계</strong> {shown.limitations}
              </p>
              {shown.observed_range && (
                <p>
                  <strong>구간별 범위</strong> {shown.observed_range[0]}–{shown.observed_range[1]}단계
                  {' · '}서로 다른 {shown.rated_scenes}개 구간에서 관찰
                </p>
              )}
              <Rubric rubric={shown.rubric} />
              <div className="assessment-scene-ratings">
                {shown.ratings.map((r) => (
                  <div key={r.scene_id}>
                    <span>
                      {sceneTitles.get(r.scene_id) ?? '장면'} <strong>{r.level}단계</strong>
                    </span>
                    <p>{r.explanation}</p>
                    <button type="button" onClick={() => onEvidence(r.observation_ids)}>
                      근거 원문 {r.observation_ids.length}개 보기 →
                    </button>
                  </div>
                ))}
              </div>
              <Counterevidence axis={shown} byId={byId} onEvidence={onEvidence} />
            </div>
          )}
          <div className="assessment-coverage">
            <span>
              검토한 기록{' '}
              <strong>
                {result.coverage.reviewed_records} / {result.coverage.available_records}
              </strong>
            </span>
            <span>
              검토 범위{' '}
              <strong>
                {result.coverage.reviewed_scenes} / {result.coverage.available_scenes}구간
              </strong>
            </span>
            <span>
              {result.meta.review_passes === 2 ? '초안 + 비판적 재검토' : '근거량 확인'}
              {result.meta.reference_repair_passes ? ' · 인용 오류 수정' : ''}
            </span>
          </div>
          <p className="detail-help">
            {result.meta.review_passes === 0
              ? '원문 근거가 충분한 수의 구간에 걸쳐 있지 않아 모델 채점을 보류했어요.'
              : result.coverage.exhaustive
                ? '확실한 인물 기록 전체를 입력으로 검토했어요.'
                : '구간과 반례를 고르게 뽑은 표본을 검토했어요. 모든 기록을 검토한 결과는 아닙니다.'}{' '}
            점수는 채점된 구간의 중앙값이며, 원문과 기준이 같아도 모델의 판단은 달라질 수 있어요.
          </p>
        </>
      )}
      <details className="assessment-method">
        <summary>
          평가를 읽는 법 <IconChevronDown size={14} />
        </summary>
        <p>
          이 점수는 소설 속에서 드러난 성향과 수행에 대한 기준별 해석입니다. 보편적인 인격·지능 검사나 인물의 가치를
          매기는 총점은 아닙니다. 강요된 선택, 독자만 아는 정보, 운 좋은 결과를 능력으로 환산하지 않습니다.
        </p>
        <p>
          현재는 장 단위로 근거를 묶고, 같은 구간은 항목별로 한 번만 셉니다. 장을 나누지 않은 원고는 한 구간으로
          처리합니다. 세 구간 미만은 판단 보류로 표시하며, 구간별 단계의 최솟값과 최댓값은 통계적 신뢰구간이 아닙니다.
          과거 시점을 선택하면 그 시점까지만 다시 평가합니다.
        </p>
      </details>
    </section>
  )
}

function Rubric({ rubric }: { rubric: CharacterRubric }) {
  return (
    <details className="assessment-anchor-list">
      <summary>
        1–5단계 판단 기준 <IconChevronDown size={14} />
      </summary>
      <ol>
        {rubric.anchors.map((anchor, i) => (
          <li key={anchor}>
            <b>{i + 1}</b>
            <span>{anchor}</span>
          </li>
        ))}
      </ol>
      <p>{rubric.caution}</p>
    </details>
  )
}

function Counterevidence({
  axis,
  byId,
  onEvidence,
}: {
  axis: CharacterAxisScore
  byId: Map<string, CharacterDetails['observations'][number]>
  onEvidence: (ids: string[]) => void
}) {
  return (
    <div className="assessment-counter">
      <h5>반대 근거와 예외</h5>
      {axis.counterevidence_ids.length ? (
        axis.counterevidence_ids.map((id) => (
          <button type="button" key={id} onClick={() => onEvidence([id])}>
            <span>{byId.get(id)?.scene_title}</span>
            <q>{byId.get(id)?.evidence.quote}</q>
            <IconArrowUpRight size={14} />
          </button>
        ))
      ) : (
        <p>검토한 자료에서 명시한 반례가 없어요. 예외가 없다는 뜻은 아닙니다.</p>
      )}
    </div>
  )
}
