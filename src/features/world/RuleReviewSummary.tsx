import type { ConflictCheck } from '../../api/types'

/** Keep keyword matches visibly separate from actual model verdicts. */
export function RuleReviewSummary({ job }: { job: ConflictCheck | null }) {
  if (!job || job.analysis_kind !== 'ai_rule_review') return null
  const assessments = job.assessments ?? []
  const supports = assessments.filter((a) => a.verdict === 'supports').length
  const violates = assessments.filter((a) => a.verdict === 'violates').length
  const unknown = assessments.filter((a) => a.verdict === 'undetermined').length
  const labels = { supports: '규칙 지지', violates: '위반', undetermined: '판단 불가' }
  return (
    <div className="evidence-box" role="status" aria-label="설정 규칙 AI 판정 결과">
      <p className="panel__title">
        {job.status === 'failed'
          ? 'AI 검토 실패 · 위반 판정 미완료'
          : job.status === 'completed'
            ? 'AI 의미 검토 완료'
            : 'AI 의미 검토'}
      </p>
      <p className="panel__label">
        키워드 단서 {job.keyword_candidate_count ?? 0}건은 위반 판정이 아니에요. AI가 규칙의 조건과 원문을 비교해요.
      </p>
      <p>
        규칙 지지 {supports}건 · 위반 {violates}건 · 판단 불가 {unknown}건
      </p>
      {unknown > 0 && (
        <p className="panel__label">
          판단 불가는 정상 판정이 아니에요. 관련 근거가 없거나 확인할 정보가 부족한 항목도 포함돼요.
        </p>
      )}
      {assessments.length > 0 && (
        <details>
          <summary>판정 근거 {assessments.length}건 보기</summary>
          {assessments.map((assessment, index) => (
            <div key={`${assessment.rule_id}/${index}`} className="evidence-box">
              <p>
                <strong>
                  {labels[assessment.verdict]} · {assessment.rule_title}
                </strong>
              </p>
              <p className="panel__label">저장 규칙: {assessment.rule_description}</p>
              {assessment.evidence && <p>원문: “{assessment.evidence}”</p>}
              <p>{assessment.reason}</p>
            </div>
          ))}
        </details>
      )}
    </div>
  )
}
