import { Link } from 'react-router-dom'
import type { ConflictCheck, NarrativeEvidence } from '../../api/types'

const states = { established: '설정 확인', changed: '변화 추적', paid_off: '회수 확인', unresolved: '미해결', reinterpreted: '오해·해석 정정' }
const kinds = { setting: '설정', relationship: '관계', foreshadowing: '복선' }

export function NarrativeSummary({ job, projectId }: { job: ConflictCheck; projectId: string }) {
  const result = job.narrative
  if (!result) return null
  function evidence(items: NarrativeEvidence[]) {
    return <ul>{items.map((e, i) => <li key={`${e.chapter_id}-${i}`}>
      <Link to={`/projects/${projectId}/manuscripts/${result!.manuscript_id}?chapter=${e.chapter_no}`}
        state={{ highlight: e.quote }}>{e.chapter_no}장 원문 보기</Link>
      <p>“{e.quote}”</p>
    </li>)}</ul>
  }
  return <section className="evidence-box" aria-label="원고 전체 설정·복선 검토">
    <h2 className="panel__title">{job.status === 'completed' ? '원고 전체 검토 결과' : job.status === 'failed' ? '원고 전체 검토를 마치지 못했어요' : '원고 전체를 대조하고 있어요'}</h2>
    <p>{result.chapter_count}장 · {result.char_count.toLocaleString()}자 · 설정·관계·복선</p>
    {result.stale && <p role="status">검사 이후 원고나 저장 규칙이 바뀌었어요. 이전 결과이므로 현재 원고로 다시 검사해 주세요.</p>}
    {['queued', 'analyzing'].includes(job.status) && <p role="status">앞부분의 설정부터 마지막 장까지 비교하고 원문 근거를 다시 확인해요. 긴 원고는 몇 분 걸릴 수 있어요. 다른 화면으로 이동해도 검사는 계속됩니다.</p>}
    {job.status === 'completed' && <>
      <p>{result.summary}</p>
      <p>충돌 후보 {result.findings.filter((f) => f.category === 'contradiction').length}건 · 설명 확인 {result.findings.filter((f) => f.category === 'explanation_gap').length}건 · 추적 항목 {result.tracks.length}건</p>
      {result.more_items && <p role="status">주요 항목부터 표시했어요. 표시 한도로 일부 항목이 포함되지 않았습니다.</p>}
      {result.findings.length > 0 && <details>
        <summary>확인할 문제와 앞뒤 근거 {result.findings.length}건</summary>
        {result.findings.map((f, i) => <article className="evidence-box" key={i}>
          <h3>{f.category === 'contradiction' ? '충돌 후보' : '설명 확인'} · {f.title}</h3>
          <p>{f.reason}</p>{evidence(f.evidence)}
        </article>)}
      </details>}
      <details><summary>자동으로 추적한 설정·관계·복선 {result.tracks.length}건</summary>
        {result.tracks.map((t, i) => <article className="evidence-box" key={i}>
          <h3>{kinds[t.kind]} · {t.title} · {states[t.status]}</h3>
          <p>{t.explanation}</p>{evidence(t.evidence)}
        </article>)}
      </details>
      <p className="panel__label">원고에서 추론한 검토 결과예요. 미해결 복선은 오류와 구분하며, 발견된 충돌이 없다고 모든 설정이 검증된 것은 아니에요.</p>
    </>}
  </section>
}
