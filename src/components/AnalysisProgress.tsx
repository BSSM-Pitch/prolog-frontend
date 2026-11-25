import './AnalysisProgress.css'

export function AnalysisProgress({ label = '분석 진행 중', completed, total }: { label?: string; completed?: number; total?: number }) {
  const measured = total != null && Number.isFinite(total) && total > 0 && completed != null && Number.isFinite(completed)
  if (!measured) return <p className="analysis-stage">{label}</p>
  const value = Math.min(total, Math.max(0, completed))
  const percent = Math.floor(value / total * 100)
  return <div className="analysis-progress">
    <span>{label} · {percent}% <small>({value}/{total} 완료)</small></span>
    <progress aria-label={label} max={total} value={value} />
  </div>
}
