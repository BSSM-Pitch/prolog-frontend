import type { Chapter, CharacterCategory, CharacterDraft, DraftItem, Manuscript, ManuscriptStatus, ManuscriptVersionDetail, Project, ProjectRole, QAMessage, QAThread } from './types'

// prolog-backend 응답 모양(openapi.json · app/**/schemas.py)과 프론트 타입 사이의 변환.
// 백엔드가 명세와 다르게 정한 이름(source_type upload, status draft·failed 등)을 여기서만 흡수한다.

export interface BackendProject {
  project_id: string
  title: string
  description: string | null
  owner_type: 'personal' | 'team'
  team_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  manuscript_count: number
}

export interface BackendMember {
  user_id: string
  role: string
  joined_at: string
  username: string
  /** 프로젝트 멤버 목록에만 있다. team이면 팀 프로젝트의 팀원(역할 변경·내보내기는 팀에서 한다) */
  source?: 'project' | 'team'
}

export interface BackendManuscript {
  manuscript_id: string
  project_id: string
  title: string
  source_type: 'editor' | 'upload'
  file_key: string | null
  content: string | null
  chapter_count: number
  status: 'draft' | 'processing' | 'ready' | 'failed'
  extraction_job_id: string | null
  created_at: string
  updated_at: string
}

export interface BackendChapter {
  chapter_id: string
  manuscript_id: string
  chapter_no: number
  title: string | null
  content: string
}

const RANK: Record<ProjectRole, number> = { viewer: 0, editor: 1, owner: 2 }
// 백엔드 app/core/deps.py TEAM_MEMBER_PROJECT_ROLE — 팀 프로젝트는 팀원에게 editor 권한을 준다
const TEAM_MEMBER_ROLE: ProjectRole = 'editor'

/**
 * 내 프로젝트 역할. 백엔드 Project 응답에는 my_role이 없어 멤버 목록으로 계산한다.
 * 팀 프로젝트는 project_members에 없어도 팀 소속만으로 editor가 된다(백엔드 project_role_of와 같은 규칙).
 */
export function roleOf(project: BackendProject, members: BackendMember[] | null, me: string | null): ProjectRole {
  let role: ProjectRole | null = null
  const row = members?.find((m) => m.user_id === me)
  if (row && row.role in RANK) role = row.role as ProjectRole
  if (!role && project.created_by === me) role = 'owner'
  if (project.owner_type === 'team' && (!role || RANK[role] < RANK[TEAM_MEMBER_ROLE])) role = TEAM_MEMBER_ROLE
  return role ?? 'viewer'
}

export function toProject(p: BackendProject, myRole: ProjectRole, teamName: string | null): Project {
  return {
    project_id: p.project_id,
    title: p.title,
    description: p.description,
    owner_type: p.owner_type,
    team_id: p.team_id,
    team_name: teamName,
    my_role: myRole,
    created_by: p.created_by,
    manuscript_count: p.manuscript_count,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

function statusOf(m: BackendManuscript): ManuscriptStatus {
  if (m.status === 'ready' || m.status === 'processing') return m.status
  if (m.status === 'failed') return 'extraction_failed'
  // draft: 업로드 원고인데 파일이 아직 올라오지 않았다(편집기 원고는 만들자마자 ready)
  return m.source_type === 'editor' ? 'ready' : 'extraction_failed'
}

/** charCount: 편집기 원고는 본문이 장에 있어 따로 세어 넘긴다 */
export function toManuscript(m: BackendManuscript, charCount?: number): Manuscript {
  // 백엔드는 원래 파일 이름을 두지 않고 저장 키(manuscripts/{p}/{m}.txt)만 준다 → "원고 제목.확장자"로 보여 준다
  const ext = m.file_key?.split('.').pop() ?? null
  const fileName = ext ? `${m.title}.${ext}` : null
  const status = statusOf(m)
  return {
    manuscript_id: m.manuscript_id,
    project_id: m.project_id,
    title: m.title,
    source_type: m.source_type === 'upload' ? 'file' : 'editor',
    file_name: fileName,
    file_format: ext,
    file_size: null,
    chapter_count: m.chapter_count,
    char_count: charCount ?? m.content?.length ?? 0,
    status,
    error:
      status !== 'extraction_failed'
        ? null
        : m.status === 'draft'
          ? { code: 'UPLOAD_INCOMPLETE', message: '파일 업로드가 끝나지 않았어요. 다시 올려 주세요.' }
          : { code: 'TEXT_EXTRACTION_FAILED', message: '파일에서 텍스트를 읽지 못했어요. 다시 시도하거나 다른 형식으로 올려 주세요.' },
    created_at: m.created_at,
    updated_at: m.updated_at,
  }
}

export function toChapter(c: BackendChapter): Chapter {
  // 백엔드 챕터 응답에는 updated_at이 없다
  return { chapter_id: c.chapter_id, manuscript_id: c.manuscript_id, chapter_no: c.chapter_no, title: c.title, content: c.content, updated_at: null }
}

// --- ASS 캐릭터 · 초안 (수동 경로) --------------------------------------------------------------------

export const CATEGORIES = ['personality_tags', 'core_values', 'influence_relations', 'emotion_keywords'] as const

export interface BackendAttribute {
  attribute_id: string
  field: CharacterCategory
  value: string
  evidence: string | null
  origin: 'ai_extracted' | 'user_added'
}

export type BackendCharacter = { character_id: string; project_id: string; name: string; created_from_draft_id: string | null; confirmed_at: string; updated_at: string } & Record<CharacterCategory, BackendAttribute[]>

export interface BackendDraftItem {
  item_id: string
  field: CharacterCategory
  value: string
  evidence: string | null
  origin: 'ai_extracted' | 'user_added'
}

export type BackendDraft = {
  draft_id: string
  project_id: string
  character_name: string | null
  status: CharacterDraft['status']
  source_job_id: string | null
  confirmed_character_id: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
} & Record<CharacterCategory, BackendDraftItem[]>

/** 백엔드는 영향 관계를 value 하나로 둔다(화면 23). 목업의 대상·유형·상태는 한 줄로 합친다 */
export function influenceText(i: { value?: string; target?: string; type?: string; status?: string | null }) {
  return [i.target ?? i.value, i.type && i.type !== '영향' ? i.type : null, i.status ? `상태: ${i.status}` : null].filter(Boolean).join(' · ')
}

export function toDraftItem(i: BackendDraftItem): DraftItem {
  return { item_id: i.item_id, field: i.field, value: i.value, origin: i.origin, evidence: i.evidence, target: i.field === 'influence_relations' ? i.value : undefined }
}

/** 백엔드 초안은 카테고리별 배열이다. 화면은 items[] 한 줄로 받는다 */
export function toDraft(d: BackendDraft): CharacterDraft {
  return {
    draft_id: d.draft_id,
    character_name: d.character_name,
    items: CATEGORIES.flatMap((f) => d[f].map(toDraftItem)),
    status: d.status,
    target_character_id: null,
    confirmed_character_id: d.confirmed_character_id,
    created_at: d.created_at,
  }
}

// --- REX 세계관 규칙 -------------------------------------------------------------------------------

export interface BackendWorldRule {
  rule_id: string
  project_id: string
  title: string
  description: string
  violation_keywords: string[]
  origin: 'ai_extracted' | 'user_added'
  extraction_id: string | null
  evidence: string | null
  source_chapter_no: number | null
  created_at: string
  updated_at: string
}

// --- FTS 복선 ------------------------------------------------------------------------------------

export interface BackendForeshadowing {
  foreshadowing_id: string
  project_id: string
  title: string
  description: string | null
  /** orphaned(설치 챕터가 지워짐)면 null */
  setup_chapter: number | null
  linked_chapters: number[]
  payoff_chapter: number | null
  status: 'unresolved' | 'resolved' | 'orphaned'
  linked_event_ids: string[]
  linked_character_ids: string[]
  chapters: Array<{ chapter_id: string; chapter_no: number | null; role: 'setup' | 'linked' | 'payoff' }>
  created_at: string
  updated_at: string
}

/** 백엔드 ID는 UUID다. 목업이 만든 ID(rule_301 등)와 구분할 때 쓴다 */
export const isBackendId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

/** "F01"·"R01" 같은 표시 번호 — 백엔드에 없어 만든 순서로 매긴다 */
export function codesByCreation<T extends { created_at: string }>(rows: T[], idOf: (r: T) => string, prefix: string) {
  const codes = new Map<string, string>()
  ;[...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || idOf(a).localeCompare(idOf(b))).forEach((r, i) => codes.set(idOf(r), `${prefix}${String(i + 1).padStart(2, '0')}`))
  return codes
}

// --- MSU 편집 이력 ---------------------------------------------------------------------------------

export interface BackendVersion {
  version_id: string
  manuscript_id: string
  version_no: number
  source: 'editor' | 'upload'
  char_count: number
  content: string
  created_by: string | null
  created_at: string
  updated_at: string
}

/** 백엔드 스냅샷은 원고 전체 본문이다(장 단위가 아니다). 창 안의 저장은 덮어써서 updated_at이 마지막 저장 시각이다 */
export function toVersion(v: BackendVersion): ManuscriptVersionDetail {
  return {
    version_id: v.version_id,
    manuscript_id: v.manuscript_id,
    chapter_id: null,
    chapter_no: null,
    chapter_title: null,
    reason: v.source === 'upload' ? 'file_upload' : 'edit',
    label: v.source === 'upload' ? '원고 파일 불러옴' : null,
    char_count: v.char_count,
    created_at: v.updated_at,
    content: v.content,
  }
}

/**
 * 장 제목 줄 — "3장 등대지기". 백엔드 AI(prolog-ai SSM)는 "N장"으로 시작하는 줄만 장 경계로 보고,
 * 다시 불러올 때(splitChapters)도 이 줄로 나눈다
 */
export const chapterHeading = (c: { chapter_no: number; title: string | null }) =>
  c.title && c.title !== `${c.chapter_no}장` ? `${c.chapter_no}장 ${c.title}` : `${c.chapter_no}장`

/** 장들을 원고 본문 한 덩어리로 — "N장 제목\n본문"을 빈 줄로 잇는다 */
export function joinChapters(chapters: Array<{ chapter_no: number; title: string | null; content: string }>) {
  return [...chapters]
    .sort((a, b) => a.chapter_no - b.chapter_no)
    .map((c) => `${chapterHeading(c)}\n${c.content}`)
    .join('\n\n')
}

// --- AIQ 원고 질문 --------------------------------------------------------------------------------

export interface BackendMessage {
  message_id: string
  thread_id: string
  role: 'user' | 'assistant'
  content: string | null
  status: 'pending' | 'completed' | 'failed'
  error: { code: string; message: string } | null
  created_at: string
}

export interface BackendThread {
  thread_id: string
  manuscript_id: string
  scope: 'whole' | 'selection'
  selection_range: { start: number; end: number } | null
  selected_text: string | null
  title: string | null
  created_at: string
  updated_at: string
}

export interface BackendThreadDetail {
  thread: BackendThread
  messages: BackendMessage[]
}

/** 백엔드 답변에는 근거 장면(citations)이 없다 */
export const toMessage = (m: BackendMessage): QAMessage => ({ ...m, citations: [] })

export const toThread = (t: BackendThread): QAThread => ({
  thread_id: t.thread_id,
  manuscript_id: t.manuscript_id,
  scope: t.scope,
  selection_range: t.selection_range,
  chapter_id: null,
  selected_text: t.selected_text,
  title: t.title ?? '질문',
  cited_chapters: [],
  created_at: t.created_at,
  updated_at: t.updated_at,
})

export const toThreadDetail = (d: BackendThreadDetail) => ({ thread: toThread(d.thread), messages: d.messages.map(toMessage) })
