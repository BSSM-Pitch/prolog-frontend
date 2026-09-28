// AUTH API 명세 2장 데이터 모델

export type UserRole = 'writer' | 'aspiring_writer' | 'reader'
export type AuthProvider = 'local' | 'google' | 'naver'
export type OAuthProvider = Exclude<AuthProvider, 'local'>

export interface User {
  user_id: string
  username: string
  email: string | null
  role: UserRole
  auth_provider: AuthProvider
  created_at: string
  updated_at: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

export interface AuthResult {
  user: User
  tokens: AuthTokens
}

// PRJ API 명세 2장 데이터 모델

export type OwnerType = 'personal' | 'team'
export type ProjectRole = 'owner' | 'editor' | 'viewer'

export interface Project {
  project_id: string
  title: string
  /** (명세 미정의) 개요 화면의 작품 소개 한 줄 */
  description: string | null
  owner_type: OwnerType
  team_id: string | null
  /** (명세 미정의) 카드의 "팀 · 문장 수집소" 표시용 */
  team_name: string | null
  /** (명세 미정의) 카드의 소유자·편집자·보기 전용 표시용 — 요청한 사용자의 역할 */
  my_role: ProjectRole
  created_by: string
  manuscript_count: number
  created_at: string
  updated_at: string
}

export type ProjectSort = 'updated_desc' | 'created_desc' | 'title_asc'

export interface ListMeta {
  next_cursor: string | null
}

export interface ProjectListMeta extends ListMeta {
  /** (명세 미정의) 탭의 "전체 5 · 개인 2 · 팀 3" 표시용 */
  counts: Record<'all' | OwnerType, number>
}

// TEAM 명세 2.1 (목록에 필요한 필드만)
// TEAM 2.1 ~ 2.3
export type TeamRole = 'owner' | 'admin' | 'member'

export interface Team {
  team_id: string
  name: string
  description: string | null
  created_by: string
  member_count: number
  created_at: string
  /** (명세 미정의) 요청한 사용자의 팀 역할 — 관리 버튼 노출용 */
  my_role: TeamRole
  /** (명세 미정의) Figma 26 "팀 프로젝트 3개" */
  project_count: number
  /** (명세 미정의) Figma 26 "초대 대기 1" — owner·admin에게만 값이 있다 */
  pending_invitation_count: number | null
}

export interface TeamMember {
  team_id: string
  user_id: string
  role: TeamRole
  joined_at: string
  /** 명세 4.6 "사용자 이름 포함" — 필드 이름은 명세 미정의 */
  name: string
  email: string | null
}

export interface TeamInvitation {
  invitation_id: string
  team_id: string
  invited_email: string
  role: Exclude<TeamRole, 'owner'>
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  created_at: string
  expires_at: string
}

// PRJ 2.2 · 2.3
export interface ProjectMember {
  project_id: string
  user_id: string
  role: ProjectRole
  joined_at: string
  /** 명세 4.6 "사용자 이름 포함" — 필드 이름은 명세 미정의 */
  name: string
  /** (명세 미정의) Figma 28의 이메일 표시 */
  email: string | null
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export interface ProjectInvitation {
  invitation_id: string
  project_id: string
  invited_email: string
  role: Exclude<ProjectRole, 'owner'>
  status: InvitationStatus
  created_at: string
  /** (명세 미정의) 팀 초대처럼 7일 뒤 만료된다고 가정 */
  expires_at: string
}

// MSU 명세 2장
export type ManuscriptSource = 'file' | 'editor'
export type ManuscriptStatus = 'processing' | 'ready' | 'extraction_failed'

export interface Manuscript {
  manuscript_id: string
  project_id: string
  title: string
  source_type: ManuscriptSource
  file_name: string | null
  file_format: string | null
  /** (명세 미정의) 업로드 목록의 "1.8MB" 표시용 */
  file_size: number | null
  chapter_count: number
  /** (명세 미정의) "82,420자" 표시용 */
  char_count: number
  status: ManuscriptStatus
  error: { code: string; message: string } | null
  created_at: string
  updated_at: string
}

export interface Chapter {
  chapter_id: string
  manuscript_id: string
  chapter_no: number
  title: string | null
  content: string
  updated_at: string
}

/**
 * (명세 미정의) MSU 4.10 편집 이력 — 명세에는 "자동저장 스냅샷 이력 목록"만 있고 필드가 없다.
 * 스냅샷은 장 단위로 남긴다.
 */
export type VersionReason = 'edit' | 'autosave' | 'file_upload' | 'import'

export interface ManuscriptVersion {
  version_id: string
  manuscript_id: string
  chapter_id: string
  chapter_no: number
  chapter_title: string | null
  reason: VersionReason
  /** "3차 원고 불러옴"처럼 목록에 보여 줄 제목. 없으면 reason으로 정한다 */
  label: string | null
  char_count: number
  created_at: string
}

export interface ManuscriptVersionDetail extends ManuscriptVersion {
  content: string
}

// AIQ 명세 2장
export interface QAThread {
  thread_id: string
  manuscript_id: string
  scope: 'whole' | 'selection'
  selection_range: { start: number; end: number } | null
  /** (명세 미정의) 선택 범위가 속한 장 */
  chapter_id: string | null
  /** (명세 미정의) 스레드를 만들 때 선택한 문장 스냅샷 — 원고가 바뀌어도 범위가 어긋나지 않게 */
  selected_text: string | null
  title: string
  /** (명세 미정의) 목록의 "17장 · 22장" 표시용 */
  cited_chapters: number[]
  created_at: string
  updated_at: string
}

export interface Citation {
  chapter_no: number
  chapter_title: string | null
  quote: string
}

export interface QAMessage {
  message_id: string
  thread_id: string
  role: 'user' | 'assistant'
  content: string | null
  status: 'pending' | 'completed' | 'failed'
  /** (명세 미정의) 답변의 근거 장면 — Figma "근거 · 17장 / 원문 보기" */
  citations: Citation[]
  error: { code: string; message: string } | null
  created_at: string
}

// NLCD · ASS 명세 — 인물

export type CharacterCategory = 'personality_tags' | 'core_values' | 'influence_relations' | 'emotion_keywords'

export interface InfluenceRelation {
  target: string
  type: string
  status: string | null
}

/** ASS 2.4 확정된 캐릭터 + (명세 미정의) 등장인물 화면용 필드 */
export interface Character {
  character_id: string
  name: string
  /** (명세 미정의) 주인공·조력자 등 — Figma 20 "주인공 · 활동 중" */
  role_label: string
  /** (명세 미정의) 활동 중·실종·상태 미확인 등 */
  status_label: string
  /** (명세 미정의) 마지막 등장 장 */
  last_chapter: number | null
  personality_tags: string[]
  core_values: string[]
  influence_relations: InfluenceRelation[]
  emotion_keywords: string[]
  /** (명세 미정의) 연결 관계 수와 주요 변화 — RCV 데이터를 인물 기준으로 모은 것 */
  relationship_count: number
  key_changes: Array<{ chapter: number; text: string }>
}

/** NLCD 2.2 */
export interface ExtractedItem {
  value: string
  evidence: string
  type?: string
}

/** NLCD 2.1 */
export interface NLExtraction {
  extraction_id: string
  source_text: string
  /** (명세 미정의) Figma 22 "인물 이름" 입력 */
  character_name: string | null
  target_character_id: string | null
  status: 'analyzing' | 'completed' | 'failed'
  personality_tags: ExtractedItem[]
  core_values: ExtractedItem[]
  influence_relations: ExtractedItem[]
  emotion_keywords: ExtractedItem[]
  duplicate_of: string | null
  forwarded_draft_id: string | null
  created_at: string
}

/** ASS 2.2 / 2.3 (영향 관계 항목은 target·type·status를 가진다) */
export interface DraftItem {
  item_id: string
  field: CharacterCategory
  value: string
  target?: string
  type?: string
  status?: string | null
  origin: 'ai_extracted' | 'user_added'
  /** (명세 미정의) NLCD가 준 원문 근거 — ERD character_draft_items.evidence */
  evidence: string | null
}

/** ASS 2.1 */
export interface CharacterDraft {
  draft_id: string
  character_name: string | null
  items: DraftItem[]
  status: 'pending_review' | 'confirmed' | 'discarded'
  target_character_id: string | null
  confirmed_character_id: string | null
  created_at: string
}

/** ASS 2.5 */
export interface EditHistoryEntry {
  action: 'added' | 'modified' | 'removed'
  field: string
  value: string
  at: string
}

// REX · SCDS 명세 — 설정 규칙과 충돌

/** REX 2.2 WorldRule (SCDS와 같은 리소스) + (명세 미정의) 화면 표시용 필드 */
export interface WorldRule {
  rule_id: string
  /** (명세 미정의) "R01" 같은 표시 번호 */
  code: string
  /** (명세 미정의) "붉은 빛과 기억" 같은 짧은 이름 */
  title: string
  description: string
  violation_keywords: string[]
  origin: 'ai_extracted' | 'user_added'
  /** (명세 미정의) 후보 상태. 명세는 후보를 추출 작업 결과에만 두고 확정분만 WorldRule로 만든다 */
  status: 'confirmed' | 'pending' | 'ignored'
  source_chapter: number | null
  evidence: string | null
}

/** SCDS 2.7 Conflict — Figma 05는 "두 근거 비교"라서 evidence[] 구조로 받는다 (명세 미정의) */
export interface Conflict {
  conflict_id: string
  index: number
  title: string
  severity: 'high' | 'medium' | 'low'
  status: 'pending' | 'accepted' | 'ignored' | 'modified'
  rule_id: string | null
  evidence: Array<{ chapter: number; character: string | null; quote: string }>
  advice: string
  modified_content: string | null
  resolved_at: string | null
}

/** SCDS 2.5 ConflictCheck / REX 2.1 RuleExtraction 작업 */
export interface ConflictCheck {
  job_id: string
  status: 'queued' | 'analyzing' | 'completed' | 'failed' | 'skipped'
  result_ids: string[]
  skipped_reason: string | null
  manuscript_id: string | null
}
export type RuleExtraction = ConflictCheck

// RCV 명세 — 관계 변화

export interface RelationshipHistoryEntry {
  chapter: number
  state: string
  trust: number | null
  /** (명세 미정의) 원인 사건 이름 — 명세는 event_id만 두지만 사건 리소스가 아직 없어 이름으로 받는다 */
  event_title: string | null
  event_deleted: boolean
}

export interface Relationship {
  relationship_id: string
  source_character_id: string
  target_character_id: string
  history: RelationshipHistoryEntry[]
}

export interface RelationshipSnapshot {
  relationship_id: string
  requested_chapter: number
  resolved_chapter: number
  state: string
  trust: number | null
  linked_event: string | null
  is_carried_forward: boolean
}

export interface MindmapGraph {
  chapter: number
  nodes: Array<{ character_id: string; name: string; role_label: string }>
  edges: Array<{
    relationship_id: string
    source_character_id: string
    target_character_id: string
    state: string
    trust: number | null
    is_carried_forward: boolean
    resolved_chapter: number
  }>
}

// FTS 명세 — 복선

export interface Foreshadowing {
  foreshadowing_id: string
  /** (명세 미정의) "F01" 같은 표시 번호 */
  code: string
  title: string
  description: string
  setup_chapter: number
  linked_chapters: number[]
  payoff_chapter: number | null
  status: 'resolved' | 'unresolved'
  /** (명세 미정의) 명세는 linked_character_ids·linked_event_ids — 목업은 이름으로 보관 */
  linked_characters: string[]
  linked_events: string[]
}

export interface Advisory {
  foreshadowing_id: string
  message: string
  setup_chapter: number
  latest_linked_chapter: number | null
  elapsed_chapters: number
  priority: 'low' | 'medium' | 'high'
}

export interface SimilarCandidate {
  foreshadowing_id: string
  code: string
  title: string
  setup_chapter: number
  payoff_chapter: number | null
}

// SSM 명세 — 스토리 구조 지도

export interface StructureNode {
  node_id: string
  type: 'event' | 'turning_point' | 'climax'
  chapter: number
  title: string
  summary: string
  /** (명세 미정의) 명세는 character_ids — 목업은 이름 */
  characters: string[]
}

export interface StructureMap {
  manuscript_id: string
  acts: Array<{ act_name: string; chapter_from: number; chapter_to: number; summary: string }>
  nodes: StructureNode[]
  edges: Array<{ from_node_id: string; to_node_id: string; relation: 'causes' | 'affects' }>
}

export interface StructureAnalysis {
  analysis_id: string
  status: 'queued' | 'analyzing' | 'completed' | 'failed'
  manuscript_id: string | null
}

/** (명세 미정의) GET /projects/{id}/overview — Figma 01 개요의 요약 카드 */
export interface ProjectOverview {
  current_manuscript: { manuscript_id: string; title: string; last_chapter: number } | null
  story: { event_count: number; analyzed_through: number } | null
  tasks: { conflicts_pending: number; foreshadowing_unscheduled: number }
  relationships: {
    chapter: number
    center: { character_id: string; name: string; role_label: string }
    edges: Array<{ character_id: string; name: string; state: string; trust: number }>
  } | null
  priority: { conflict_id: string; index: number; title: string; severity: 'high' | 'medium' | 'low'; chapters: number[] } | null
}

export interface ApiErrorBody {
  code: string
  message: string
  details: Record<string, unknown>
}
