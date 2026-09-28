import type { StructureAnalysis, StructureMap } from '../../types'
import { requireProject, touchProject } from '../access'
import { splitSentences } from '../ai'
import { emptyWorld, type MockChapter, type MockDb, type MockJob, type MockStory } from '../db'
import type { DemoStoryNode } from '../demo'
import { fail, isResponse, nextId, ok, stamp, str, type Body, type Route } from '../http'

const ANALYZE_MS = 3000
const MIN_CHAPTERS = 3
const world = (db: MockDb, projectId: string) => (db.worlds[projectId] ??= emptyWorld())

/** 원고의 장으로 막 구조와 주요 사건을 만든다 (목업 SSM) */
function buildStory(chapters: MockChapter[]): MockStory {
  const sorted = [...chapters].sort((a, b) => a.chapter_no - b.chapter_no)
  const n = sorted.length
  // 장이 4개보다 적으면 위기를 빼고 3막으로 나눈다
  const names = n >= 4 ? ['발단', '전개', '위기', '절정'] : ['발단', '전개', '절정']
  const cut = (i: number) => Math.round((n * i) / names.length)
  const acts = names.map((act_name, i) => {
    const from = sorted[cut(i)]?.chapter_no ?? 1
    const to = sorted[Math.max(cut(i + 1) - 1, cut(i))]?.chapter_no ?? from
    return { act_name, chapter_from: from, chapter_to: to, summary: `${from}–${to}장의 흐름` }
  })
  // 막마다 첫 장과 마지막 장을 주요 사건으로 고른다
  const picks = [...new Set(acts.flatMap((a) => [a.chapter_from, a.chapter_to]))].sort((a, b) => a - b)
  const nodes: DemoStoryNode[] = picks.map((no, i) => {
    const c = sorted.find((x) => x.chapter_no === no)!
    const first = splitSentences(c.content)[0] ?? c.content.slice(0, 60)
    return {
      node_id: `node_${String(no).padStart(2, '0')}`,
      chapter: no,
      title: (c.title ?? '').replace(new RegExp(`^${no}장\\s*[·:.-]?\\s*`), '') || `${no}장의 사건`,
      type: i === picks.length - 1 ? 'climax' : acts.some((a) => a.chapter_from === no && a.act_name !== '발단') ? 'turning_point' : 'event',
      summary: first.length > 60 ? `${first.slice(0, 58)}…` : first,
      characters: [],
    }
  })
  const edges = nodes.slice(1).map((node, i) => ({ from: nodes[i].node_id, to: node.node_id, relation: 'causes' as const }))
  return { acts, nodes, edges }
}

const filled = (db: MockDb, manuscriptId: string) => db.chapters.filter((c) => c.manuscript_id === manuscriptId && c.content.trim())

/** 장이 가장 많은 원고를 본편으로 본다. 시연 작품의 지도(world.story)는 본편의 것이다 */
function isPrimary(db: MockDb, projectId: string, manuscriptId: string) {
  const counts = db.manuscripts.filter((m) => m.project_id === projectId).map((m) => [m.manuscript_id, filled(db, m.manuscript_id).length] as const)
  return counts.sort((a, b) => b[1] - a[1])[0]?.[0] === manuscriptId
}

function storyOf(db: MockDb, projectId: string, manuscriptId: string): MockStory | null {
  const w = world(db, projectId)
  return (isPrimary(db, projectId, manuscriptId) ? w.story : w.stories?.[manuscriptId]) ?? null
}

function saveStory(db: MockDb, projectId: string, manuscriptId: string, story: MockStory) {
  const w = world(db, projectId)
  if (isPrimary(db, projectId, manuscriptId)) w.story = story
  else w.stories = { ...w.stories, [manuscriptId]: story }
}

function toMap(db: MockDb, projectId: string, manuscriptId: string): StructureMap | null {
  const story = storyOf(db, projectId, manuscriptId)
  if (!story) return null
  return {
    manuscript_id: manuscriptId,
    acts: story.acts,
    nodes: story.nodes.map((n) => ({ node_id: n.node_id, type: n.type, chapter: n.chapter, title: n.title, summary: n.summary, characters: n.characters })),
    edges: story.edges.map((e) => ({ from_node_id: e.from, to_node_id: e.to, relation: e.relation })),
  }
}

function toAnalysis(j: MockJob): StructureAnalysis {
  return { analysis_id: j.job_id, status: j.status === 'skipped' ? 'failed' : j.status, manuscript_id: j.manuscript_id }
}

function settle(db: MockDb) {
  for (const j of db.jobs) {
    if (j.kind !== 'structure_analysis' || j.ready_at === null) continue
    if (j.status === 'queued' && j.ready_at - ANALYZE_MS / 2 <= Date.now()) j.status = 'analyzing'
    if (j.ready_at > Date.now()) continue
    j.ready_at = null
    if (j.will_fail) {
      j.status = 'failed'
      j.will_fail = false
      continue
    }
    // 이미 지도가 있으면(시연 작품 포함) 사용자가 고친 노드를 지키기 위해 그대로 두고, 없을 때만 새로 만든다
    const msId = j.manuscript_id ?? ''
    if (!storyOf(db, j.project_id, msId)) saveStory(db, j.project_id, msId, buildStory(filled(db, msId)))
    j.status = 'completed'
  }
}

const base = '/projects/:projectId/manuscripts/:manuscriptId'

// SSM 명세
export const storyRoutes: Route[] = [
  [
    'GET',
    `${base}/structure-map`,
    (req, db, { projectId, manuscriptId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      settle(db)
      const map = toMap(db, projectId, manuscriptId)
      return map ? ok(200, map) : fail(404, 'STRUCTURE_MAP_NOT_FOUND', '아직 분석한 구조 지도가 없어요.')
    },
  ],
  [
    // 4.1 구조 분석 요청 — 분량이 부족하면 422 MANUSCRIPT_TOO_SHORT
    'POST',
    `${base}/structure-analyses`,
    (req, db, { projectId, manuscriptId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const chapters = filled(db, manuscriptId)
      if (!db.manuscripts.some((m) => m.manuscript_id === manuscriptId && m.project_id === projectId)) return fail(404, 'MANUSCRIPT_NOT_FOUND', '원고를 찾을 수 없어요.')
      if (chapters.length < MIN_CHAPTERS) {
        return fail(422, 'MANUSCRIPT_TOO_SHORT', `구조를 나누려면 내용이 있는 장이 ${MIN_CHAPTERS}개 이상 필요해요.`, { chapter_count: chapters.length })
      }
      const job: MockJob = {
        job_id: nextId(db, 'ssm'),
        project_id: projectId,
        kind: 'structure_analysis',
        status: 'queued',
        manuscript_id: manuscriptId,
        ready_at: Date.now() + ANALYZE_MS,
        will_fail: Boolean((req.body as Body)?.simulate_failure),
        result_ids: [],
        skipped_reason: null,
        created_at: stamp(),
      }
      db.jobs.push(job)
      return ok(202, toAnalysis(job))
    },
  ],
  [
    'GET',
    `${base}/structure-analyses/:analysisId`,
    (req, db, { projectId, analysisId }) => {
      const access = requireProject(req, db, projectId)
      if (isResponse(access)) return access
      settle(db)
      const job = db.jobs.find((j) => j.job_id === analysisId && j.project_id === projectId)
      return job ? ok(200, toAnalysis(job), { retry_after_ms: job.ready_at ? 1000 : null }) : fail(404, 'STRUCTURE_ANALYSIS_NOT_FOUND', '분석 작업을 찾을 수 없어요.')
    },
  ],
  [
    // 4.6 노드 수정 — AI 분석 결과를 사용자가 조정
    'PATCH',
    `${base}/structure-map/nodes/:nodeId`,
    (req, db, { projectId, manuscriptId, nodeId }) => {
      const access = requireProject(req, db, projectId, 'editor')
      if (isResponse(access)) return access
      const node = storyOf(db, projectId, manuscriptId)?.nodes.find((n) => n.node_id === nodeId)
      if (!node) return fail(404, 'STRUCTURE_NODE_NOT_FOUND', '사건을 찾을 수 없어요.')
      const b = (req.body ?? {}) as Body
      if (b.title !== undefined) {
        if (!str(b.title)) return fail(400, 'INVALID_INPUT', '사건 제목을 입력해 주세요.', { field: 'title' })
        node.title = str(b.title)
      }
      if (b.summary !== undefined) node.summary = str(b.summary)
      touchProject(db, projectId)
      return ok(200, { node_id: node.node_id, type: node.type, chapter: node.chapter, title: node.title, summary: node.summary, characters: node.characters })
    },
  ],
]
