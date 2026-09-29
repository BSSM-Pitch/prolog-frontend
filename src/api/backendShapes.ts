import type { Chapter, Manuscript, ManuscriptStatus, Project, ProjectRole } from './types'

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
