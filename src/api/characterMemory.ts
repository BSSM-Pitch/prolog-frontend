import { request } from './client'

export interface MemoryJob {
  analysis_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress: {
    processed_scenes: number
    total_scenes: number
    observations: number
    verified_speakers: number
    patterns: number
    completed_requests: number
  }
  error: { code: string; message: string } | null
  discovery: {
    version: number
    processed_chunks: number
    total_chunks: number
    complete: boolean
    candidates: DiscoveredCharacter[]
  } | null
}
export interface DiscoveredCharacter {
  candidate_id: string
  name: string
  kind: 'named_person' | 'ambiguous'
  alias_of: string | null
  reason: string
  evidence: { scene_id: string; revision: string; start: number; end: number; quote: string }
  status: 'pending' | 'added' | 'existing' | 'needs_review' | 'confirmed' | 'dismissed'
  character_id: string | null
}
export interface MemoryOverview {
  manuscript_id: string
  job: MemoryJob | null
  available_analysis_id: string | null
  stale: boolean
  job_stale: boolean
  mode: 'real' | 'fake' | null
  can_analyze: boolean
  character_counts: Record<string, number>
  chapters: Array<{ order: number; title: string }>
}
export interface DetailRecord {
  observation_id: string
  kind: 'speech' | 'action' | 'inner_thought' | 'narration'
  presentation: 'depicted' | 'character_claim' | 'narrator_claim' | 'thought'
  behavior_role: 'trigger' | 'awareness' | 'desire' | 'involuntary_reaction' | 'choice' | 'other'
  attribution: 'certain' | 'uncertain'
  summary: string
  context: string
  order: number
  chapter_id: string | null
  scene_title: string
  story_time: string | null
  interlocutor_ids: string[]
  interlocutors: string[]
  evidence: { scene_id: string; revision: string; start: number; end: number; quote: string }
  source: { before: string; quote: string; after: string }
  speaker_check: { reason: string; adjudicated: boolean; evidence: { quote: string } } | null
}
export interface DetailPattern {
  pattern_id: string
  description: string
  condition: string
  status: 'recurring' | 'contested'
  supporting_scene_count: number
  counterexample_scene_count: number
  supporting_observation_ids: string[]
  counterexample_observation_ids: string[]
}
export interface MetricPeriod {
  orders: number[]
  record_count: number
  record_ids: string[]
  choice_count: number
  reaction_count: number
  choice_ids: string[]
  reaction_ids: string[]
  choice_share: number | null
  classified_count: number
  other_count: number
  small_sample: boolean
  partner_counts: Record<string, number>
  interaction_ids: string[]
}
export interface CharacterDetails {
  character_id: string
  character_name: string | null
  manuscript_id: string
  manuscript_title: string
  analysis_id: string
  snapshot_id: string
  stale: boolean
  mode: 'real' | 'fake'
  generated_at: string
  counts: {
    observations: number
    patterns: number
    uncertain: number
    scenes: number
    speech: number
    action: number
    inner_thought: number
    narration: number
  }
  observations: DetailRecord[]
  uncertain_observations: DetailRecord[]
  patterns: DetailPattern[]
  hypotheses: Array<{ hypothesis_id: string; pattern_id: string; statement: string; alternatives: string[] }>
  coverage: { exhaustive: false; patterns_hidden_by_cutoff: number; speaker_verification_complete: boolean }
  metrics: {
    basis: 'extracted_records'
    window_size: number
    recent: MetricPeriod
    previous: MetricPeriod
    choice_delta_pp: number | null
    timeline: Array<MetricPeriod & { order: number }>
  }
}

const base = (project: string, manuscript: string) => `/projects/${project}/manuscripts/${manuscript}`
export const getMemory = (token: string, project: string, manuscript: string) =>
  request<MemoryOverview>('GET', `${base(project, manuscript)}/character-memory`, { accessToken: token })
export const buildMemory = (token: string, project: string, manuscript: string) =>
  request<MemoryJob>('POST', `${base(project, manuscript)}/character-memory`, { accessToken: token })
export const retryMemory = (token: string, project: string, manuscript: string, analysis: string) =>
  request<MemoryJob>('POST', `${base(project, manuscript)}/character-memory/${analysis}/retry`, { accessToken: token })
export const resolveCandidate = (
  token: string,
  project: string,
  manuscript: string,
  analysis: string,
  candidate: string,
  action: 'create' | 'link' | 'dismiss',
  characterId?: string,
  name?: string,
) =>
  request<DiscoveredCharacter>(
    'POST',
    `${base(project, manuscript)}/character-memory/${analysis}/candidates/${candidate}/resolve`,
    {
      accessToken: token,
      body: { action, character_id: characterId ?? null, name: name ?? null },
    },
  )
export const getDetails = (token: string, project: string, manuscript: string, character: string, order: string) =>
  request<CharacterDetails>('GET', `${base(project, manuscript)}/characters/${character}/details`, {
    accessToken: token,
    query: order ? { through_order: order } : undefined,
  })
