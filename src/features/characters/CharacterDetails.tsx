import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconArrowUpRight, IconBook2, IconChartBar, IconChevronDown, IconSearch } from '@tabler/icons-react'
import * as api from '../../api/characterMemory'
import type { CharacterDetails as DetailData, DetailRecord, MemoryOverview } from '../../api/characterMemory'
import { listManuscripts } from '../../api/manuscripts'
import { IS_REAL } from '../../api/config'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { describeError } from '../../lib/errors'
import { useInterval, useResource } from '../../lib/useResource'
import { projectPath } from '../app/currentProject'
import {
  kindLabel,
  patternRecords,
  periodLabel,
  presentationLabel,
  roleLabel,
  visibleRecords,
  type DetailCategory,
} from './detailModel'
import './details.css'
import { CharacterAssessment } from './CharacterAssessment'
import { CharacterDiscovery, type PersonOption } from './CharacterDiscovery'

export function CharacterDetails({
  projectId,
  characterId,
  canEdit,
  characters,
  onCharactersChanged,
  initialManuscriptId,
}: {
  projectId: string
  characterId?: string
  canEdit: boolean
  characters: PersonOption[]
  onCharactersChanged: () => void
  initialManuscriptId?: string
}) {
  const manuscripts = useResource((t) => listManuscripts(t, projectId), [projectId])
  const [chosen, setChosen] = useState(initialManuscriptId ?? '')
  const items = (manuscripts.data ?? []).filter((m) => m.status === 'ready')
  const manuscript = items.find((m) => m.manuscript_id === chosen) ?? items[0]
  if (!IS_REAL)
    return (
      <div className="detail-empty">
        <IconBook2 size={26} />
        <h3>원문에서 인물의 디테일을 모아요</h3>
        <p>
          실제 서버에 연결하면 원고별 발화·행동·심리 변화의 근거를 볼 수 있어요. 예시 모드에서는 분석 결과를 만들지
          않아요.
        </p>
      </div>
    )
  if (manuscripts.error)
    return (
      <p className="notice notice--error" role="alert">
        {manuscripts.error}
      </p>
    )
  if (manuscripts.loading) return <p role="status">원고를 불러오고 있어요.</p>
  if (!manuscript)
    return (
      <div className="detail-empty">
        <h3>원고가 있으면 디테일이 쌓여요</h3>
        <Link to={projectPath(projectId, 'manuscripts')}>원고 추가하기 →</Link>
      </div>
    )
  return (
    <div className="character-details">
      <div className="detail-heading">
        <div>
          <p className="detail-eyebrow">인물 기록</p>
          <h3>작은 단서까지, 원문 그대로</h3>
        </div>
        <label className="detail-select">
          <span>분석 원고</span>
          <Select aria-label="분석 원고" value={manuscript.manuscript_id} onChange={(e) => setChosen(e.target.value)}>
            {items.map((m) => (
              <option key={m.manuscript_id} value={m.manuscript_id}>
                {m.title}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <MemoryWorkspace
        key={`${projectId}:${manuscript.manuscript_id}`}
        {...{ projectId, characterId, canEdit, characters, onCharactersChanged }}
        manuscriptId={manuscript.manuscript_id}
      />
    </div>
  )
}

function MemoryWorkspace({
  projectId,
  manuscriptId,
  characterId,
  canEdit,
  characters,
  onCharactersChanged,
}: {
  projectId: string
  manuscriptId: string
  characterId?: string
  canEdit: boolean
  characters: PersonOption[]
  onCharactersChanged: () => void
}) {
  const state = useResource((t) => api.getMemory(t, projectId, manuscriptId), [projectId, manuscriptId])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState('')
  const { withAuth } = useSession()
  const memory = state.data
  const working = memory?.job?.status === 'queued' || memory?.job?.status === 'running'
  useInterval(state.reload, 4000, working)
  const discoveryComplete = memory?.job?.discovery?.complete
  const analysisId = memory?.job?.analysis_id
  useEffect(() => {
    if (discoveryComplete) onCharactersChanged()
  }, [analysisId, discoveryComplete, onCharactersChanged])
  async function analyze(retry = false) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await withAuth((t) =>
        retry && memory?.job
          ? api.retryMemory(t, projectId, manuscriptId, memory.job.analysis_id)
          : api.buildMemory(t, projectId, manuscriptId),
      )
      state.reload()
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }
  if (state.error)
    return (
      <div role="alert">
        <p className="notice notice--error">{state.error}</p>
        <Button tone="outline" onClick={state.reload}>
          다시 불러오기
        </Button>
      </div>
    )
  if (!memory) return <p role="status">인물 기록을 확인하고 있어요.</p>
  return (
    <>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {memory.job?.discovery && (
        <CharacterDiscovery
          {...{ projectId, manuscriptId, characters, canEdit }}
          job={memory.job}
          onChange={() => {
            state.reload()
            onCharactersChanged()
          }}
        />
      )}
      {memory.stale && (
        <div className="detail-notice">원고 또는 인물 정보가 바뀌었어요. 아래 기록은 이전 원고를 기준으로 합니다.</div>
      )}
      {memory.mode === 'fake' && (
        <div className="detail-notice">테스트 모드로 만든 빈 분석입니다. 실제 디테일 분석 결과가 아니에요.</div>
      )}
      {working ? (
        <div className="memory-progress" role="status">
          <span className="memory-pulse" />
          <div>
            <strong>
              {memory.job?.status === 'queued'
                ? '인물 기록 분석을 기다리고 있어요'
                : memory.job?.discovery && !memory.job.discovery.complete
                  ? '원고에서 등장인물을 찾고 있어요'
                  : '원문에서 인물의 디테일을 모으고 있어요'}
            </strong>
            <p>
              장면 추출 {memory.job?.progress.processed_scenes} / {memory.job?.progress.total_scenes} · 관찰{' '}
              {memory.job?.progress.observations}개 · 대사 검증 {memory.job?.progress.verified_speakers}개
            </p>
            <small>다른 작업을 하거나 화면을 닫아도 분석은 계속됩니다.</small>
          </div>
        </div>
      ) : memory.job?.status === 'failed' ? (
        <div className="detail-notice">
          <p>분석이 중단됐어요. 완료한 구간은 보관했습니다.</p>
          {canEdit && (
            <Button busy={busy} disabled={busy} onClick={() => analyze(!memory.job_stale)}>
              {memory.job_stale ? '현재 원고로 분석' : '이어서 분석'}
            </Button>
          )}
        </div>
      ) : !memory.available_analysis_id ? (
        <div className="detail-empty">
          <IconBook2 size={28} />
          <h3>
            {memory.job?.status === 'completed'
              ? '인물을 확인하면 디테일 분석을 이어갈 수 있어요'
              : '원고에서 인물을 찾고, 디테일까지 모아요'}
          </h3>
          <p>
            원고에서 새 인물을 자동 추가하고, 발화와 작은 행동을 인물별로 모아요.
            <br />
            장편의 상세 분석은 수시간 걸릴 수 있어요.
          </p>
          {canEdit && memory.can_analyze && (memory.job?.status !== 'completed' || memory.job_stale) ? (
            <Button disabled={busy} busy={busy} onClick={() => analyze()}>
              원고 분석 · 인물 자동 추가
            </Button>
          ) : (
            <p>
              {canEdit
                ? memory.job?.status === 'completed'
                  ? '위 후보를 확인하거나 새 인물을 추가한 뒤 다시 분석해 주세요.'
                  : '내용이 있는 원고가 필요해요.'
                : '작품 편집자가 분석을 시작하면 기록을 볼 수 있어요.'}
            </p>
          )}
        </div>
      ) : (
        (memory.stale || !memory.job?.discovery) &&
        canEdit && (
          <Button disabled={busy} busy={busy} tone="outline" onClick={() => analyze()}>
            원고 분석 · 새 인물 찾기
          </Button>
        )
      )}
      {memory.available_analysis_id && characterId && (
        <>
          <div className="detail-scope">
            <span>살펴볼 시점</span>
            <Select aria-label="살펴볼 시점" value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="">원고 전체</option>
              {memory.chapters.map((c) => (
                <option key={c.order} value={c.order}>
                  {c.title}까지
                </option>
              ))}
            </Select>
          </div>
          <Dossier
            key={`${characterId}:${memory.available_analysis_id}:${order}`}
            {...{ projectId, manuscriptId, characterId, order, memory, canEdit }}
          />
        </>
      )}
    </>
  )
}

function Dossier({
  projectId,
  manuscriptId,
  characterId,
  order,
  memory,
  canEdit,
}: {
  projectId: string
  manuscriptId: string
  characterId: string
  order: string
  memory: MemoryOverview
  canEdit: boolean
}) {
  const resource = useResource(
    (t) => api.getDetails(t, projectId, manuscriptId, characterId, order),
    [projectId, manuscriptId, characterId, order, memory.available_analysis_id],
  )
  const [category, setCategory] = useState<DetailCategory>('all')
  const [query, setQuery] = useState('')
  const [ids, setIds] = useState<string[] | null>(null)
  const [shown, setShown] = useState(12)
  const evidenceRef = useRef<HTMLDivElement>(null)
  if (resource.error)
    return (
      <div role="alert">
        <p className="notice notice--error">{resource.error}</p>
        <Button tone="outline" onClick={resource.reload}>
          다시 불러오기
        </Button>
      </div>
    )
  if (!resource.data || resource.loading) return <p role="status">원문 근거를 불러오고 있어요.</p>
  const data = resource.data
  const records = visibleRecords(data, category, query, ids)
  const patterns = patternRecords(data.patterns, data.observations).filter((p) =>
    [
      p.description,
      p.condition,
      ...p.support.map((r) => r.evidence.quote),
      ...p.counterexamples.map((r) => r.evidence.quote),
    ]
      .join(' ')
      .includes(query.trim()),
  )
  const tabs: Array<[DetailCategory, string, number]> = [
    ['all', '전체 기록', data.counts.observations],
    ['speech', '말과 표현', data.counts.speech],
    ['action', '행동', data.counts.action],
    ['inner_thought', '내면', data.counts.inner_thought],
    ['patterns', '반복과 예외', data.counts.patterns],
    ['uncertain', '화자 확인', data.counts.uncertain],
  ]
  function evidence(selected: string[]) {
    setIds(selected)
    setCategory('all')
    setQuery('')
    setShown(12)
    requestAnimationFrame(() => {
      evidenceRef.current?.focus({ preventScroll: true })
      evidenceRef.current?.scrollIntoView({ block: 'start' })
    })
  }
  return (
    <>
      <CharacterAssessment
        {...{ projectId, manuscriptId, characterId, order, data, canEdit }}
        onEvidence={evidence}
        onRefresh={resource.reload}
      />
      <details className="detail-statistics">
        <summary>행동 빈도와 구간별 기록 보기</summary>
        <Metrics data={data} onEvidence={evidence} />
      </details>
      <div className="detail-tabs" role="group" aria-label="인물 기록 종류" ref={evidenceRef} tabIndex={-1}>
        {tabs.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            aria-pressed={category === key}
            onClick={() => {
              setCategory(key)
              setIds(null)
              setShown(12)
            }}
          >
            {label} <span>{count}</span>
          </button>
        ))}
      </div>
      <div className="detail-search">
        <IconSearch size={18} />
        <input
          aria-label="디테일 검색"
          type="search"
          placeholder="말, 행동, 원문으로 찾아보기"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShown(12)
          }}
        />
        {ids && (
          <button type="button" onClick={() => setIds(null)}>
            근거 필터 해제 ×
          </button>
        )}
      </div>
      {category === 'uncertain' && (
        <p className="detail-help">
          이 인물의 말로 추출됐거나 검토됐지만 화자가 확실하지 않은 기록입니다. 위 수치와 반복 경향에서는 제외했어요.
        </p>
      )}
      {category === 'patterns' && data.coverage.patterns_hidden_by_cutoff > 0 && (
        <p className="detail-help">
          선택한 시점 이후까지 읽고 만든 반복 경향은 숨겼어요. 이 시점의 원문 기록은 다른 탭에서 볼 수 있어요.
        </p>
      )}
      <div className="detail-result-count">
        {category === 'patterns' ? patterns.length : records.length}개 기록 {ids && '· 선택한 평가·수치의 근거'}
      </div>
      {category === 'patterns' ? (
        <div className="detail-patterns">
          {patterns.slice(0, shown).map((p) => (
            <article className="detail-pattern" key={p.pattern_id}>
              <div className="detail-card-top">
                <span className={`detail-badge ${p.status === 'contested' ? 'detail-badge--amber' : ''}`}>
                  {p.status === 'contested' ? '예외가 있는 경향' : '반복 경향'}
                </span>
                <span>
                  지지 {p.supporting_scene_count}장면 · 반례 {p.counterexample_scene_count}장면
                </span>
              </div>
              <h4>{p.description}</h4>
              <p className="detail-context">{p.condition}</p>
              <div className="pattern-evidence">
                <details>
                  <summary>
                    지지 근거 {p.support.length}개 <IconChevronDown size={16} />
                  </summary>
                  {p.support.map((r) => (
                    <Record key={r.observation_id} row={r} {...{ projectId, manuscriptId }} stale={data.stale} />
                  ))}
                </details>
                <details>
                  <summary>
                    반례 {p.counterexamples.length}개 <IconChevronDown size={16} />
                  </summary>
                  {p.counterexamples.length ? (
                    p.counterexamples.map((r) => (
                      <Record key={r.observation_id} row={r} {...{ projectId, manuscriptId }} stale={data.stale} />
                    ))
                  ) : (
                    <p className="detail-help">
                      추출된 기록에서 연결된 반례가 없어요. 작품 전체에 예외가 없다는 뜻은 아닙니다.
                    </p>
                  )}
                </details>
              </div>
              {data.hypotheses
                .filter((h) => h.pattern_id === p.pattern_id)
                .map((h) => (
                  <div className="detail-hypothesis" key={h.hypothesis_id}>
                    <span>잠정 해석</span>
                    <p>{h.statement}</p>
                    {h.alternatives.length > 0 && (
                      <details>
                        <summary>다른 설명도 살펴보기</summary>
                        <ul>
                          {h.alternatives.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ))}
            </article>
          ))}
        </div>
      ) : (
        <div className="detail-records">
          {records.slice(0, shown).map((r) => (
            <Record key={r.observation_id} row={r} {...{ projectId, manuscriptId }} stale={data.stale} />
          ))}
        </div>
      )}
      {(category === 'patterns' ? patterns.length : records.length) === 0 && (
        <div className="detail-empty detail-empty--small">
          <h4>이 조건에 맞는 기록이 없어요</h4>
          <p>추출 누락이 있을 수 있어요. 원문에 해당 행동이 없다는 뜻은 아닙니다.</p>
        </div>
      )}
      {(category === 'patterns' ? patterns.length : records.length) > shown && (
        <Button block tone="outline" onClick={() => setShown((n) => n + 12)}>
          기록 더 보기
        </Button>
      )}
      <p className="detail-footnote">
        원문 위치를 대조한 기록입니다. 발화 주체와 해석은 AI가 분류했으므로 작가의 확인이 필요해요. 분석{' '}
        {new Date(data.generated_at).toLocaleDateString('ko-KR')}
      </p>
    </>
  )
}

function Metrics({ data, onEvidence }: { data: DetailData; onEvidence: (ids: string[]) => void }) {
  const { recent, previous, timeline, choice_delta_pp: delta } = data.metrics
  const max = Math.max(1, ...timeline.map((t) => t.choice_count + t.reaction_count))
  const names = new Map(
    data.observations.flatMap((r) => r.interlocutor_ids.map((id, i) => [id, r.interlocutors[i]] as const)),
  )
  const partners = Object.entries(recent.partner_counts).sort((a, b) => b[1] - a[1])
  return (
    <section className="character-metrics" aria-labelledby="metric-title">
      <div className="metrics-heading">
        <div>
          <span className="detail-eyebrow">
            <IconChartBar size={15} /> 상황을 읽는 수치
          </span>
          <h4 id="metric-title">최근 {recent.orders.length}개 구간의 인물</h4>
        </div>
        <span>{periodLabel(recent.orders)}</span>
      </div>
      <div className="metric-grid">
        <button
          type="button"
          className="metric"
          onClick={() => onEvidence([...recent.choice_ids, ...recent.reaction_ids])}
        >
          <span>
            선택 비중 <IconArrowUpRight size={15} />
          </span>
          <strong>{recent.choice_share === null ? '—' : `${recent.choice_share}%`}</strong>
          <small>
            선택 {recent.choice_count} / 선택·반응 {recent.classified_count}건
          </small>
          <em>{delta === null ? '이전 구간 비교 자료 부족' : `이전보다 ${delta > 0 ? '+' : ''}${delta}%p`}</em>
        </button>
        <button type="button" className="metric" onClick={() => onEvidence(recent.reaction_ids)}>
          <span>
            비의도적 반응 <IconArrowUpRight size={15} />
          </span>
          <strong>
            {recent.reaction_count}
            <b>건</b>
          </strong>
          <small>추출된 반응 기록</small>
          <em>
            {previous.orders.length
              ? `이전 ${previous.orders.length}개 구간 ${previous.reaction_count}건`
              : '이전 구간 없음'}
          </em>
        </button>
        <button type="button" className="metric" onClick={() => onEvidence(recent.interaction_ids)}>
          <span>
            상호작용 상대 <IconArrowUpRight size={15} />
          </span>
          <strong>
            {partners.length ? (
              <>
                {partners.length}
                <b>명</b>
              </>
            ) : (
              '미기록'
            )}
          </strong>
          <small>상대가 기록된 관찰 {recent.interaction_ids.length}건</small>
          <em>{partners.length ? '관계의 친밀도와는 별개예요' : '실제 상호작용이 없다는 뜻은 아니에요'}</em>
        </button>
        <button type="button" className="metric" onClick={() => onEvidence(recent.record_ids)}>
          <span>
            수치의 원문 근거 <IconArrowUpRight size={15} />
          </span>
          <strong>
            {recent.record_count}
            <b>건</b>
          </strong>
          <small>선택·반응 외 기록 {recent.other_count}건</small>
          <em>{recent.small_sample ? '선택·반응 표본이 5건 미만이에요' : '클릭해서 원문 확인'}</em>
        </button>
      </div>
      <div className="metric-timeline">
        <div className="metric-legend">
          <span>
            <i /> 선택
          </span>
          <span>
            <i /> 비의도적 반응
          </span>
          <small>구간별 기록 수 · 막대를 누르면 근거를 봐요</small>
        </div>
        <div className="metric-bars">
          {timeline.map((t) => (
            <button
              type="button"
              key={t.order}
              aria-label={`${t.order} 구간: 선택 ${t.choice_count}건, 비의도적 반응 ${t.reaction_count}건`}
              onClick={() => onEvidence([...t.choice_ids, ...t.reaction_ids])}
            >
              <span className="metric-bar-track">
                <i style={{ height: `${(100 * t.reaction_count) / max}%` }} />
                <i style={{ height: `${(100 * t.choice_count) / max}%` }} />
              </span>
              <small>{t.order}</small>
            </button>
          ))}
        </div>
      </div>
      {partners.length > 0 && (
        <div className="metric-partners">
          <span>최근 상호작용</span>
          {partners.map(([id, count]) => (
            <button
              type="button"
              key={id}
              onClick={() =>
                onEvidence(
                  data.observations
                    .filter((r) => recent.record_ids.includes(r.observation_id) && r.interlocutor_ids.includes(id))
                    .map((r) => r.observation_id),
                )
              }
            >
              {names.get(id) ?? '인물'} <strong>{count}건</strong>
            </button>
          ))}
        </div>
      )}
      <details className="metric-method">
        <summary>
          수치 계산 기준과 한계 <IconChevronDown size={14} />
        </summary>
        <p>
          선택 비중 = 선택으로 분류된 기록 ÷ (선택 + 비의도적 반응 기록). 같은 원문 위치와 역할이 중복된 기록은 한 번만
          셉니다. 최근 구간은 선택한 시점까지의 마지막 3개 장면, 비교 구간은 그 앞 3개 장면이에요. 두 구간이 모두 3개
          장면이며 선택·반응 기록이 있을 때만 비중 차이를 표시합니다.
        </p>
        <p>
          추출된 기록을 집계한 값이며 심리 상태나 주도성을 평가한 점수가 아닙니다. 0건은 기록이 없다는 뜻이에요. 누락과
          분류 오류가 있을 수 있고, 화자가 불확실한 기록은 집계하지 않습니다. 자기 진술과 서술자의 설명도 포함하므로
          근거 카드의 표현 방식을 함께 확인하세요.
        </p>
      </details>
    </section>
  )
}

function Record({
  row,
  projectId,
  manuscriptId,
  stale,
}: {
  row: DetailRecord
  projectId: string
  manuscriptId: string
  stale: boolean
}) {
  return (
    <article className="detail-record">
      <div className="detail-card-top">
        <div>
          <span className={`detail-badge ${row.attribution === 'uncertain' ? 'detail-badge--amber' : ''}`}>
            {row.attribution === 'uncertain' ? '화자 확인 필요' : kindLabel[row.kind]}
          </span>
          {roleLabel[row.behavior_role] && <span className="detail-role">{roleLabel[row.behavior_role]}</span>}
        </div>
        <span>{row.scene_title}</span>
      </div>
      <h4>{row.summary}</h4>
      <blockquote>{row.evidence.quote}</blockquote>
      <p className="detail-context">{row.context}</p>
      <div className="detail-record-footer">
        <span>
          {presentationLabel[row.presentation]}
          {row.interlocutors.length ? ` · 상대 ${row.interlocutors.join(', ')}` : ''}
        </span>
        <span>{row.story_time}</span>
      </div>
      <details className="detail-source">
        <summary>
          앞뒤 원문 확인 <IconChevronDown size={15} />
        </summary>
        <p className="source-paragraph">
          {row.source.before}
          <mark>{row.source.quote}</mark>
          {row.source.after}
        </p>
        {row.speaker_check && (
          <div className="speaker-reason">
            <strong>화자 검토 근거</strong>
            <p>{row.speaker_check.reason}</p>
            <q>{row.speaker_check.evidence.quote}</q>
          </div>
        )}
        <Link
          to={`${projectPath(projectId, `manuscripts/${manuscriptId}`)}${row.chapter_id ? `?chapter=${row.order}` : ''}`}
          state={
            stale
              ? undefined
              : { highlight: row.evidence.quote, memoryRange: { start: row.evidence.start, end: row.evidence.end } }
          }
        >
          <IconBook2 size={16} /> {stale ? '수정된 현재 원고 열기' : '원고에서 보기'}
        </Link>
        <small>
          {stale
            ? '위 인용은 분석 당시 원고입니다. 현재 원고와 다를 수 있어요.'
            : '분석 당시 원문과 일치하는 인용이에요.'}
        </small>
      </details>
    </article>
  )
}
