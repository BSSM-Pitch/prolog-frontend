import { request } from './client'

export interface CharacterRubric {
  id: string
  label: string
  group: string
  question: string
  anchors: string[]
  caution: string
}
export interface CharacterAxisScore {
  axis_id: string
  rubric: CharacterRubric
  verdict: string
  conditions: string
  limitations: string
  status: 'scored' | 'insufficient_evidence' | 'unverified_evidence'
  score: number | null
  observed_range: number[] | null
  rated_scenes: number
  ratings: Array<{ scene_id: string; level: number; observation_ids: string[]; explanation: string }>
  counterevidence_ids: string[]
}
export interface CharacterAssessmentResult {
  rubric_version: string
  axes: CharacterAxisScore[]
  minimum_rated_scenes: number
  aggregation: 'median_of_unique_scene_ratings'
  coverage: {
    available_records: number
    reviewed_records: number
    available_scenes: number
    reviewed_scenes: number
    exhaustive: boolean
  }
  meta: { model?: string; review_passes?: number; reference_repair_passes?: number }
}
export interface CharacterAssessmentJob {
  assessment_id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped'
  result: CharacterAssessmentResult | null
  error: string | null
  finished_at: string | null
}
export interface CharacterAssessmentOverview {
  rubric_version: string
  rubric: CharacterRubric[]
  memory_analysis_id: string
  stale: boolean
  job: CharacterAssessmentJob | null
}
const path = (project: string, manuscript: string, character: string) =>
  `/projects/${project}/manuscripts/${manuscript}/characters/${character}/assessment`
const options = (token: string, order: string) => ({
  accessToken: token,
  query: order ? { through_order: order } : undefined,
})
export const getAssessment = (token: string, project: string, manuscript: string, character: string, order: string) =>
  request<CharacterAssessmentOverview>('GET', path(project, manuscript, character), options(token, order))
export const buildAssessment = (token: string, project: string, manuscript: string, character: string, order: string) =>
  request<CharacterAssessmentJob>('POST', path(project, manuscript, character), options(token, order))
