import type { OwnerType, Project, ProjectSort } from '../../types'
import { requireProject } from '../access'
import { emptyWorld, type MockDb, type MockProject } from '../db'
import { authenticate, fail, isResponse, nextId, ok, paginate, stamp, str, type Body, type Route } from '../http'

export function toProject(db: MockDb, p: MockProject, userId: string): Project {
  const member = db.projectMembers.find((m) => m.project_id === p.project_id && m.user_id === userId)
  return {
    project_id: p.project_id,
    title: p.title,
    description: p.description,
    owner_type: p.owner_type,
    team_id: p.team_id,
    team_name: db.teams.find((t) => t.team_id === p.team_id)?.name ?? null,
    my_role: member?.role ?? 'viewer',
    created_by: p.created_by,
    manuscript_count: db.manuscripts.filter((m) => m.project_id === p.project_id).length,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }
}

const SORTERS: Record<ProjectSort, (a: MockProject, b: MockProject) => number> = {
  updated_desc: (a, b) => b.updated_at.localeCompare(a.updated_at),
  created_desc: (a, b) => b.created_at.localeCompare(a.created_at),
  title_asc: (a, b) => a.title.localeCompare(b.title, 'ko'),
}

/** 장 번호 기준으로 관계 이력에서 해당 시점 상태를 찾는다 (RCV 직전 챕터 이어받기) */
function snapshotAt<T extends { chapter: number }>(history: T[], chapter: number): T | null {
  return [...history].filter((h) => h.chapter <= chapter).sort((a, b) => b.chapter - a.chapter)[0] ?? null
}

// PRJ 명세 + (명세 미정의) 개요 집계
export const projectRoutes: Route[] = [
  [
    'GET',
    '/projects',
    (req, db) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user

      const ownerType = req.query.owner_type as OwnerType | undefined
      if (ownerType && ownerType !== 'personal' && ownerType !== 'team') {
        return fail(400, 'INVALID_INPUT', 'owner_type은 personal 또는 team이어야 해요.')
      }
      const sort = (req.query.sort ?? 'updated_desc') as ProjectSort
      if (!SORTERS[sort]) return fail(400, 'INVALID_INPUT', '지원하지 않는 정렬이에요.')

      const mine = db.projects.filter((p) => db.projectMembers.some((m) => m.project_id === p.project_id && m.user_id === user.user_id))
      const filtered = mine.filter((p) => !ownerType || p.owner_type === ownerType).sort(SORTERS[sort])
      const { page, next_cursor } = paginate(req, filtered)

      return ok(200, page.map((p) => toProject(db, p, user.user_id)), {
        next_cursor,
        counts: {
          all: mine.length,
          personal: mine.filter((p) => p.owner_type === 'personal').length,
          team: mine.filter((p) => p.owner_type === 'team').length,
        },
      })
    },
  ],
  [
    'POST',
    '/projects',
    (req, db) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const b = (req.body ?? {}) as Body
      const title = str(b.title)
      const ownerType = b.owner_type as OwnerType
      if (!title) return fail(400, 'INVALID_INPUT', '프로젝트 이름을 입력해 주세요.', { field: 'title' })
      if (title.length > 100) return fail(400, 'INVALID_INPUT', '프로젝트 이름은 100자 이하로 정해 주세요.', { field: 'title' })
      if (ownerType !== 'personal' && ownerType !== 'team') return fail(400, 'INVALID_INPUT', '작업 방식을 골라 주세요.')

      let teamId: string | null = null
      if (ownerType === 'team') {
        teamId = str(b.team_id)
        if (!db.teams.some((t) => t.team_id === teamId)) return fail(404, 'TEAM_NOT_FOUND', '팀을 찾을 수 없어요.', { field: 'team_id' })
        const inTeam = db.teamMembers.some((m) => m.user_id === user.user_id && m.team_id === teamId)
        if (!inTeam) return fail(403, 'NOT_TEAM_MEMBER', '이 팀의 팀원만 팀 프로젝트를 만들 수 있어요.')
      }

      const t = stamp()
      const project: MockProject = {
        project_id: nextId(db, 'proj'),
        title,
        description: null,
        owner_type: ownerType,
        team_id: teamId,
        created_by: user.user_id,
        created_at: t,
        updated_at: t,
      }
      db.projects.push(project)
      db.projectMembers.push({ project_id: project.project_id, user_id: user.user_id, role: 'owner', joined_at: t })
      db.worlds[project.project_id] = emptyWorld()
      return ok(201, toProject(db, project, user.user_id))
    },
  ],
  [
    'GET',
    '/projects/:projectId',
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId)
      return isResponse(access) ? access : ok(200, toProject(db, access.project, access.user.user_id))
    },
  ],
  [
    'GET',
    '/projects/:projectId/overview',
    (req, db, { projectId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      const world = db.worlds[projectId] ?? emptyWorld()

      const manuscripts = db.manuscripts
        .filter((m) => m.project_id === projectId && m.status === 'ready')
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      const current = manuscripts[0]
      const currentChapters = current ? db.chapters.filter((c) => c.manuscript_id === current.manuscript_id) : []
      const lastChapter = currentChapters.reduce((max, c) => Math.max(max, c.chapter_no), 0)

      // 주인공(첫 번째 인물)을 중심으로, 가장 최근에 관계가 바뀐 장 시점의 관계도
      const center = world.characters[0]
      let relationships = null
      if (center) {
        const mine = world.relationships.filter((r) => r.source === center.character_id || r.target === center.character_id)
        const chapter = mine.flatMap((r) => r.history.map((h) => h.chapter)).reduce((max, c) => Math.max(max, c), 0)
        if (chapter > 0) {
          relationships = {
            chapter,
            center: { character_id: center.character_id, name: center.name, role_label: center.role_label },
            edges: mine
              .map((r) => {
                const otherId = r.source === center.character_id ? r.target : r.source
                const snap = snapshotAt(r.history, chapter)
                return snap && { character_id: otherId, name: world.characters.find((c) => c.character_id === otherId)?.name ?? '?', state: snap.state, trust: snap.trust }
              })
              .filter(Boolean),
          }
        }
      }

      const pending = world.conflicts.filter((c) => c.status === 'pending')
      const priority = [...pending].sort((a, b) => ['high', 'medium', 'low'].indexOf(a.severity) - ['high', 'medium', 'low'].indexOf(b.severity))[0]

      return ok(200, {
        current_manuscript: current ? { manuscript_id: current.manuscript_id, title: current.title, last_chapter: lastChapter } : null,
        story: world.story
          ? { event_count: world.story.nodes.length, analyzed_through: world.story.acts.reduce((max, a) => Math.max(max, a.chapter_to), 0) }
          : null,
        tasks: {
          conflicts_pending: pending.length,
          foreshadowing_unscheduled: world.foreshadowings.filter((f) => f.payoff_chapter === null).length,
        },
        relationships,
        priority: priority
          ? {
              conflict_id: priority.conflict_id,
              index: world.conflicts.indexOf(priority) + 1,
              title: priority.title,
              severity: priority.severity,
              chapters: priority.evidence.map((e) => e.chapter),
            }
          : null,
      })
    },
  ],
  [
    // TEAM 4.1 내가 속한 팀 목록
    'GET',
    '/teams',
    (req, db) => {
      const user = authenticate(req, db)
      if (isResponse(user)) return user
      const teamIds = new Set(db.teamMembers.filter((m) => m.user_id === user.user_id).map((m) => m.team_id))
      return ok(200, db.teams.filter((t) => teamIds.has(t.team_id)), { next_cursor: null })
    },
  ],
]
