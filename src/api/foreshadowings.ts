import { codesByCreation, type BackendChapter, type BackendCharacter, type BackendForeshadowing, type BackendManuscript } from './backendShapes'
import { ApiError, request, requestAll, requestWithMeta } from './client'
import { IS_REAL } from './config'
import type { Advisory, Foreshadowing, SimilarCandidate } from './types'

// FTS 명세 — 복선

const base = (projectId: string) => `/projects/${projectId}/foreshadowings`
const one = (projectId: string, id: string) => `${base(projectId)}/${id}`

type CreateInput = { title: string; description?: string; setup_chapter: number; linked_characters?: string[] }
type UpdateInput = Partial<CreateInput>

export function listForeshadowings(token: string, projectId: string) {
  if (IS_REAL) return real.list(token, projectId)
  return request<Foreshadowing[]>('GET', base(projectId), { accessToken: token })
}

/** 4.2 생성 — 비슷한 복선이 있으면 meta.similar_candidates로 알려 준다 (생성은 막지 않음) */
export function createForeshadowing(token: string, projectId: string, input: CreateInput) {
  if (IS_REAL) return real.create(token, projectId, input)
  return requestWithMeta<Foreshadowing, { similar_candidates?: SimilarCandidate[] }>('POST', base(projectId), { body: input, accessToken: token })
}

export function updateForeshadowing(token: string, projectId: string, id: string, input: UpdateInput) {
  if (IS_REAL) return real.update(token, projectId, id, input)
  return request<Foreshadowing>('PATCH', one(projectId, id), { body: input, accessToken: token })
}

export function deleteForeshadowing(token: string, projectId: string, id: string) {
  return request<null>('DELETE', one(projectId, id), { accessToken: token })
}

export async function addLinkedChapter(token: string, projectId: string, id: string, chapter: number) {
  if (!IS_REAL) return request<Foreshadowing>('POST', `${one(projectId, id)}/linked-chapters`, { body: { chapter }, accessToken: token })
  const ctx = await real.context(token, projectId)
  await request<BackendForeshadowing>('POST', `${one(projectId, id)}/linked-chapters`, { body: { chapter_id: ctx.chapterId(chapter) }, accessToken: token })
  return real.find(token, projectId, id)
}

export async function removeLinkedChapter(token: string, projectId: string, id: string, chapter: number) {
  if (!IS_REAL) return request<null>('DELETE', `${one(projectId, id)}/linked-chapters/${chapter}`, { accessToken: token })
  // 백엔드는 챕터 ID로 뺀다. 이 복선에 연결된 챕터 중에서 번호가 같은 것을 찾는다
  const f = await request<BackendForeshadowing>('GET', one(projectId, id), { accessToken: token })
  const ref = f.chapters.find((c) => c.role === 'linked' && c.chapter_no === chapter)
  if (!ref) throw new ApiError(404, { code: 'LINKED_CHAPTER_NOT_FOUND', message: '연결 챕터가 없어요.', details: {} })
  return request<null>('DELETE', `${one(projectId, id)}/linked-chapters/${ref.chapter_id}`, { accessToken: token })
}

/** 4.8 회수 처리 — 설치 장보다 앞이면 400 INVALID_PAYOFF_CHAPTER */
export async function setPayoff(token: string, projectId: string, id: string, payoff_chapter: number) {
  if (!IS_REAL) return request<Foreshadowing>('PUT', `${one(projectId, id)}/payoff`, { body: { payoff_chapter }, accessToken: token })
  const ctx = await real.context(token, projectId)
  await request<BackendForeshadowing>('PUT', `${one(projectId, id)}/payoff`, { body: { payoff_chapter_id: ctx.chapterId(payoff_chapter) }, accessToken: token })
  return real.find(token, projectId, id)
}

/** 4.9 회수 취소 — 미회수면 409 PAYOFF_NOT_SET */
export async function cancelPayoff(token: string, projectId: string, id: string) {
  if (!IS_REAL) return request<Foreshadowing>('DELETE', `${one(projectId, id)}/payoff`, { accessToken: token })
  await request<BackendForeshadowing>('DELETE', `${one(projectId, id)}/payoff`, { accessToken: token })
  return real.find(token, projectId, id)
}

export async function listAdvisories(token: string, projectId: string, currentChapter: number) {
  const rows = await request<Advisory[]>('GET', `${base(projectId)}/unresolved/advisories`, { query: { current_chapter: String(currentChapter) }, accessToken: token })
  // 백엔드 안내에는 경과 장 수가 없다 (경과 = 현재 − 설치, 백엔드 미회수 목록과 같은 셈)
  return rows.map((a) => ({ ...a, elapsed_chapters: a.elapsed_chapters ?? Math.max(0, currentChapter - a.setup_chapter) }))
}

// --- real 모드 (prolog-backend FTS) ----------------------------------------------------------------
// 백엔드는 챕터를 번호가 아니라 ID로 받는다(원고가 여럿이면 번호가 겹친다). 화면은 번호로 다루므로
// 복선 화면이 "현재 장"으로 쓰는 원고(가장 최근에 만든 ready 원고)의 장 번호를 ID로 바꾼다.
// 관련 인물은 이름으로 다루고 백엔드 인물 ID와 바꾼다. 사건 연결은 백엔드에 아직 없다(SCDS 이후).

const real = {
  async context(token: string, projectId: string) {
    const [manuscripts, chapters, characters] = await Promise.all([
      requestAll<BackendManuscript>(`/projects/${projectId}/manuscripts`, { accessToken: token }),
      requestAll<BackendChapter>(`/projects/${projectId}/chapters`, { accessToken: token }),
      requestAll<BackendCharacter>(`/projects/${projectId}/characters`, { accessToken: token }),
    ])
    // 화면(toManuscript)과 같은 기준의 ready — 편집기 원고는 draft여도 ready로 본다
    const main = manuscripts.find((m) => m.status === 'ready' || (m.status === 'draft' && m.source_type === 'editor'))
    return {
      chapterId(no: number) {
        const c = chapters.find((x) => x.manuscript_id === main?.manuscript_id && x.chapter_no === no) ?? chapters.find((x) => x.chapter_no === no)
        if (!c) throw new ApiError(400, { code: 'INVALID_INPUT', message: `${no}장이 없어요. 원고에 있는 장을 골라 주세요.`, details: { field: 'chapter' } })
        return c.chapter_id
      },
      characterIds(names: string[]) {
        return names.map((n) => characters.find((c) => c.name === n)?.character_id).filter((id): id is string => Boolean(id))
      },
      nameOf: new Map(characters.map((c) => [c.character_id, c.name])),
    }
  },

  toForeshadowing(f: BackendForeshadowing, code: string, nameOf: Map<string, string>): Foreshadowing {
    return {
      foreshadowing_id: f.foreshadowing_id,
      code,
      title: f.title,
      description: f.description ?? '',
      setup_chapter: f.setup_chapter ?? 0,
      linked_chapters: f.linked_chapters,
      payoff_chapter: f.payoff_chapter,
      status: f.status,
      linked_characters: f.linked_character_ids.map((id) => nameOf.get(id)).filter((n): n is string => Boolean(n)),
      linked_events: [],
    }
  },

  async list(token: string, projectId: string) {
    const [rows, characters] = await Promise.all([
      requestAll<BackendForeshadowing>(base(projectId), { accessToken: token }),
      requestAll<BackendCharacter>(`/projects/${projectId}/characters`, { accessToken: token }),
    ])
    const codes = codesByCreation(rows, (f) => f.foreshadowing_id, 'F')
    const nameOf = new Map(characters.map((c) => [c.character_id, c.name]))
    return rows.map((f) => real.toForeshadowing(f, codes.get(f.foreshadowing_id)!, nameOf))
  },

  async find(token: string, projectId: string, id: string) {
    const f = (await real.list(token, projectId)).find((x) => x.foreshadowing_id === id)
    if (!f) throw new ApiError(404, { code: 'FORESHADOWING_NOT_FOUND', message: '해당 복선을 찾을 수 없어요.', details: {} })
    return f
  },

  async create(token: string, projectId: string, input: CreateInput) {
    const ctx = await real.context(token, projectId)
    const res = await requestWithMeta<BackendForeshadowing, { similar_candidates?: Array<{ foreshadowing_id: string; title: string }> }>('POST', base(projectId), {
      body: {
        title: input.title,
        description: input.description || null,
        setup_chapter_id: ctx.chapterId(input.setup_chapter),
        linked_character_ids: ctx.characterIds(input.linked_characters ?? []),
      },
      accessToken: token,
    })
    const all = await real.list(token, projectId)
    // 백엔드 후보에는 번호·장이 없어 목록에서 채운다
    const similar = (res.meta.similar_candidates ?? [])
      .map((c) => all.find((f) => f.foreshadowing_id === c.foreshadowing_id))
      .filter((f): f is Foreshadowing => Boolean(f))
      .map((f): SimilarCandidate => ({ foreshadowing_id: f.foreshadowing_id, code: f.code, title: f.title, setup_chapter: f.setup_chapter, payoff_chapter: f.payoff_chapter }))
    return { data: all.find((f) => f.foreshadowing_id === res.data.foreshadowing_id)!, meta: { similar_candidates: similar } }
  },

  /** 제목·설명·설치 장은 PATCH, 관련 인물은 연결을 더하고 푸는 것으로 맞춘다 */
  async update(token: string, projectId: string, id: string, input: UpdateInput) {
    const [ctx, current] = await Promise.all([real.context(token, projectId), request<BackendForeshadowing>('GET', one(projectId, id), { accessToken: token })])
    const body: Record<string, unknown> = {}
    if (input.title !== undefined) body.title = input.title
    if (input.description !== undefined) body.description = input.description || null
    if (input.setup_chapter !== undefined && input.setup_chapter !== current.setup_chapter) body.setup_chapter_id = ctx.chapterId(input.setup_chapter)
    if (Object.keys(body).length) await request<BackendForeshadowing>('PATCH', one(projectId, id), { body, accessToken: token })
    if (input.linked_characters) {
      const want = new Set(ctx.characterIds(input.linked_characters))
      const have = new Set(current.linked_character_ids)
      for (const target of want) if (!have.has(target)) await request('POST', `${one(projectId, id)}/links`, { body: { target_type: 'character', target_id: target }, accessToken: token })
      for (const target of have) if (!want.has(target)) await request('DELETE', `${one(projectId, id)}/links/character/${target}`, { accessToken: token })
    }
    return real.find(token, projectId, id)
  },
}
