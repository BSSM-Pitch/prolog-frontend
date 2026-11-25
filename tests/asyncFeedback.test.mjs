/* oxlint-disable react/globals -- Tests expose hook snapshots to assertions outside the probe. */
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createElement as h, act } from 'react'
let createRoot
import { createServer } from 'vite'

let server, SessionContext, useResource, useExtraction, useAnswer, CharacterAssessment, AnswerCard, AddRelationship, useEditorSplit, isBackendRoute
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const fixtures = {}
globalThis.__prologAsyncFixtures = fixtures
const session = { user: { user_id: 'author' }, withAuth: async (call) => call('test-only') }
before(async () => {
  const dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost/' })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.ResizeObserver = class { observe() {} disconnect() {} }
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false }
  ;({ createRoot } = await import('react-dom/client'))
  server = await createServer({ server: { middlewareMode: true }, plugins: [{
    name: 'async-feedback-fixtures', enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('/src/api/config.ts')) return code.replace("import.meta.env?.VITE_API_MODE === 'real'", 'true')
    },
    load(id) {
      const groups = {
        '/src/api/characters.ts': ['listExtractions', 'getExtraction'],
        '/src/api/manuscripts.ts': ['streamMessage', 'getMessage', 'retryMessage'],
        '/src/api/characterAssessment.ts': ['getAssessment', 'buildAssessment'],
      }
      const names = Object.entries(groups).find(([path]) => id.endsWith(path))?.[1]
      if (names) return names.map((name) => `export const ${name} = (...args) => globalThis.__prologAsyncFixtures.${name}(...args);`).join('\n')
    },
  }] })
  ;({ SessionContext } = await server.ssrLoadModule('/src/auth/sessionContext.ts'))
  ;({ useResource } = await server.ssrLoadModule('/src/lib/useResource.ts'))
  ;({ useExtraction } = await server.ssrLoadModule('/src/features/characters/useExtraction.ts'))
  ;({ useAnswer } = await server.ssrLoadModule('/src/features/manuscripts/useAnswer.ts'))
  ;({ CharacterAssessment } = await server.ssrLoadModule('/src/features/characters/CharacterAssessment.tsx'))
  ;({ AddRelationship } = await server.ssrLoadModule('/src/features/relationships/AddRelationship.tsx'))
  ;({ useEditorSplit } = await server.ssrLoadModule('/src/features/manuscripts/useEditorSplit.tsx'))
  ;({ isBackendRoute } = await server.ssrLoadModule('/src/api/config.ts'))
  ;({ AnswerCard } = await server.ssrLoadModule('/src/features/manuscripts/AnswerCard.tsx'))
})
after(async () => { await server?.close(); window.close(); delete globalThis.__prologAsyncFixtures })

async function mount(t, Component, value = session) {
  const element = document.createElement('div'); document.body.append(element)
  const root = createRoot(element)
  await act(async () => root.render(h(SessionContext.Provider, { value }, h(Component))))
  let removed = false
  const unmount = async () => { if (!removed) { removed = true; await act(async () => root.unmount()); element.remove() } }
  t.after(unmount)
  return { element, unmount }
}

for (const period of [1500, 4000]) {
  test(`slow status responses survive multiple ${period}ms polling periods and stop on completion`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const replies = [deferred(), deferred()]
    let calls = 0, resource
    function Probe() { resource = useResource(() => replies[calls++].promise, ['same'], { pollInterval: (data) => data?.status === 'completed' ? false : period }); return null }
    await mount(t, Probe)
    await act(async () => t.mock.timers.tick(period * 5))
    assert.equal(calls, 1)
    await act(async () => replies[0].resolve({ status: 'running' }))
    assert.equal(resource.data.status, 'running')
    await act(async () => t.mock.timers.tick(period))
    assert.equal(calls, 2)
    await act(async () => t.mock.timers.tick(period * 5))
    assert.equal(calls, 2)
    await act(async () => replies[1].resolve({ status: 'completed' }))
    assert.equal(resource.data.status, 'completed')
    await act(async () => t.mock.timers.tick(period * 5))
    assert.equal(calls, 2)
  })
}

test('status polling recovers after a network error without resubmitting AI work', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let calls = 0, resource
  function Probe() { resource = useResource(async () => { calls++; if (calls === 1) throw Error('offline'); return { status: 'completed' } }, ['retry-get'], { pollInterval: (data) => data?.status === 'completed' ? false : 4000 }); return null }
  await mount(t, Probe)
  assert.ok(resource.error)
  await act(async () => t.mock.timers.tick(4000))
  assert.equal(resource.error, null)
  assert.equal(resource.data.status, 'completed')
  assert.equal(calls, 2)
})

const extraction = { extraction_id: 'saved-extraction', status: 'completed', source_text: '윤서는 약속을 지킨다.', character_name: '윤서', personality_tags: [], core_values: [], influence_relations: [], emotion_keywords: [] }
test('an extraction accepted after navigation restores from the server on return without another POST', async (t) => {
  sessionStorage.clear()
  fixtures.listExtractions = async () => [extraction]
  let reads = 0, posts = 0, work
  fixtures.getExtraction = async () => { reads++; return extraction }
  function Probe() { work = useExtraction('project', ''); return null }
  const first = await mount(t, Probe)
  const reply = deferred()
  let pending
  await act(async () => { pending = work.submit(() => { posts++; return reply.promise }) })
  assert.equal(work.busy, true)
  await first.unmount()
  await act(async () => { reply.resolve(extraction); await pending })
  await mount(t, Probe)
  assert.equal(work.job.extraction_id, extraction.extraction_id)
  assert.equal(work.job.source_text, extraction.source_text)
  assert.equal(reads, 1)
  assert.equal(posts, 1)
})

test('server history restores a job when browser storage is unavailable', async (t) => {
  sessionStorage.clear()
  const original = globalThis.sessionStorage
  globalThis.sessionStorage = { getItem() { throw Error('denied') }, setItem() { throw Error('denied') }, removeItem() { throw Error('denied') } }
  t.after(() => { globalThis.sessionStorage = original })
  fixtures.listExtractions = async () => [extraction]
  fixtures.getExtraction = async () => extraction
  let work
  function Probe() { work = useExtraction('history-project', ''); return null }
  await mount(t, Probe)
  assert.equal(work.history.data[0].extraction_id, extraction.extraction_id)
  await act(async () => work.select(extraction.extraction_id))
  assert.equal(work.job.source_text, extraction.source_text)
})

const target = { projectId: 'project', manuscriptId: 'manuscript', threadId: 'thread', messageId: 'message' }
const message = { message_id: 'message', status: 'failed', content: '', citations: [] }
test('answer retry shows pending immediately and rejects repeated clicks while the POST is unresolved', async (t) => {
  let answer, calls = 0
  const reply = deferred()
  fixtures.retryMessage = () => { calls++; return reply.promise }
  fixtures.streamMessage = async () => new Promise(() => {})
  function Probe() { answer = useAnswer(target, message); return h(AnswerCard, { message: answer.message, error: answer.error, onRetry: answer.retry, retrying: answer.retrying }) }
  const { element } = await mount(t, Probe)
  let first
  await act(async () => { first = answer.retry(); void answer.retry() })
  assert.equal(calls, 1)
  assert.match(element.textContent, /다시 답변을 요청하고 있어요/)
  assert.equal(element.querySelector('button'), null)
  await act(async () => { reply.resolve({ ...message, status: 'pending' }); await first })
  assert.equal(answer.message.status, 'pending')
})

test('pending answer displays connection errors and reconnect only reads existing work', async (t) => {
  let answer, reads = 0
  fixtures.streamMessage = async () => { throw Error('offline') }
  fixtures.getMessage = async () => { reads++; if (reads === 1) throw Error('offline'); return { ...message, status: 'completed', content: '완료' } }
  fixtures.retryMessage = () => assert.fail('reconnecting must not POST')
  function Probe() { answer = useAnswer(target, { ...message, status: 'pending' }); return h(AnswerCard, { message: answer.message, error: answer.error, onRetry: answer.retry, onReconnect: answer.reconnect }) }
  const { element } = await mount(t, Probe)
  assert.match(element.textContent, /답변 상태를 확인하지 못했어요/)
  assert.match(element.textContent, /연결 다시 확인/)
  await act(async () => answer.reconnect())
  assert.equal(answer.message.status, 'completed')
  assert.equal(answer.error, null)
  assert.equal(reads, 2)
})

test('assessment POST result fills the gap before the next GET and blocks duplicate submissions', async (t) => {
  let reads = 0, posts = 0
  const refresh = deferred(), accepted = deferred()
  fixtures.getAssessment = async () => { reads++; return reads === 1 ? { memory_analysis_id: 'memory', stale: false, rubric: [], job: null } : refresh.promise }
  fixtures.buildAssessment = () => { posts++; return accepted.promise }
  const data = { analysis_id: 'memory', observations: [] }
  function Probe() { return h(CharacterAssessment, { projectId: 'p', manuscriptId: 'm', characterId: 'c', order: '', data, canEdit: true, onEvidence() {}, onRefresh() {} }) }
  const { element } = await mount(t, Probe)
  const button = [...element.querySelectorAll('button')].find((b) => b.textContent === '원문으로 인물 평가하기')
  await act(async () => { button.click(); button.click() })
  assert.equal(posts, 1)
  assert.match(element.textContent, /인물 평가를 요청하고 있어요/)
  await act(async () => accepted.resolve({ assessment_id: 'accepted', status: 'queued', result: null }))
  assert.match(element.textContent, /인물 평가를 기다리고 있어요/)
  assert.ok(!element.textContent.includes('원문으로 인물 평가하기'))
  assert.equal(reads, 2)
})

const proposal = {
  draft_id: 'draft-one', chapter_id: 'chapter-one', status: 'completed', stale: false,
  result: { source_character_id: 'a', target_character_id: 'b', state: '동맹', trust: null,
    event_title: '윤서와 도윤이 함께 성문을 지키기로 했다.', explanation: '공동의 목표에 합의했어요.', evidence: ['함께 성문을 지키자.'] },
}
const relationProps = {
  projectId: 'project', manuscriptId: 'manuscript', chapter: 1, chapters: [1],
  chapterRows: [{ chapter_id: 'chapter-one', chapter_no: 1 }],
  people: [{ character_id: 'a', name: '윤서' }, { character_id: 'b', name: '도윤' }], onCancel() {},
}
function respond(data) { return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } }) }
function setInput(input, value) {
  const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}
test('relationship draft uses real API routes, fills the direct form and saves only reviewed edits', async (t) => {
  assert.ok(isBackendRoute('POST', '/projects/project/relationship-drafts'))
  assert.ok(isBackendRoute('GET', '/projects/project/relationship-drafts/draft-one'))
  const post = deferred(), get = deferred()
  const calls = [], saved = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, options.method, options.body])
    assert.match(url, /relationship-drafts/)
    return options.method === 'POST' ? post.promise : get.promise
  })
  const { element } = await mount(t, () => h(AddRelationship, { ...relationProps, onSubmit: async (data) => { saved.push(data) } }))
  assert.match(element.textContent, /초안을 작성하고 있어요/)
  assert.equal(element.querySelector('button[type="submit"]').disabled, true)
  await act(async () => post.resolve(respond({ ...proposal, status: 'queued', result: null })))
  await act(async () => get.resolve(respond(proposal)))
  assert.equal(element.querySelector('input[required]').value, '동맹')
  assert.equal(element.querySelector('input[type="number"]').value, '')
  assert.equal(element.querySelector('textarea').value, proposal.result.event_title)
  assert.equal(saved.length, 0)
  await act(async () => setInput(element.querySelector('input[required]'), '조건부 동맹'))
  await act(async () => setInput(element.querySelector('textarea'), '내가 확인한 관계 변화'))
  await act(async () => element.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })))
  assert.equal(saved.length, 1)
  assert.equal(saved[0].initial_history.state, '조건부 동맹')
  assert.equal(saved[0].initial_history.event_title, '내가 확인한 관계 변화')
  assert.equal(calls.filter((c) => c[1] === 'POST').length, 1)
})

test('late AI completion preserves input after writer chooses manual entry', async (t) => {
  const get = deferred()
  t.mock.method(globalThis, 'fetch', async (_, options) => options.method === 'POST' ? respond({ ...proposal, status: 'queued', result: null }) : get.promise)
  const { element } = await mount(t, () => h(AddRelationship, { ...relationProps, onSubmit: async () => {} }))
  const manual = [...element.querySelectorAll('button')].find((b) => b.textContent === '직접 입력하기')
  await act(async () => manual.click())
  await act(async () => setInput(element.querySelector('input[required]'), '갈등'))
  await act(async () => get.resolve(respond(proposal)))
  assert.equal(element.querySelector('input[required]').value, '갈등')
})

test('editor separator supports keyboard resizing and remembers the chosen split', async (t) => {
  localStorage.clear()
  function Probe() { const split = useEditorSplit(); return h('div', { ref: split.layout, style: split.style }, split.separator) }
  const { element, unmount } = await mount(t, Probe)
  const separator = element.querySelector('[role="separator"]')
  assert.equal(separator.getAttribute('aria-valuenow'), '68')
  await act(async () => separator.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
  assert.equal(separator.getAttribute('aria-valuenow'), '66')
  await unmount()
  const second = await mount(t, Probe)
  assert.equal(second.element.querySelector('[role="separator"]').getAttribute('aria-valuenow'), '66')
})
