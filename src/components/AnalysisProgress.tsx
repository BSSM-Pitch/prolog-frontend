import './AnalysisProgress.css'

export function AnalysisProgress({ label = '분석 진행 중', completed, total }: { label?: string; completed?: number; total?: number }) {
  const measured = total != null && total > 0 && completed != null
  const value = measured ? Math.min(total, Math.max(0, completed)) : undefined
  return <div className="analysis-progress">
    <progress aria-label={label} max={measured ? total : undefined} value={value} />
    <span>{label}{measured ? ` · ${value}/${total} 완료` : ''}</span>
  </div>
}
