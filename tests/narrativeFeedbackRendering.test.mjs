import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

test('request feedback takes precedence over an old completed result or an empty review', async () => {
  const server = await createServer({ server: { middlewareMode: true } })
  try {
    const { NarrativeSummary } = await server.ssrLoadModule('/src/features/world/NarrativeSummary.tsx')
    const { SessionContext } = await server.ssrLoadModule('/src/auth/sessionContext.ts')
    for (const scope of ['setting', 'relationship', 'foreshadowing']) {
      for (const job of [null, { status: 'completed', narrative: { tracks: [], findings: [] } }]) {
        const html = renderToStaticMarkup(h(MemoryRouter, null,
          h(SessionContext.Provider, { value: { withAuth: () => { throw Error('SSR must not call API') } } },
            h(NarrativeSummary, { projectId: 'test', scope, job, starting: true }))))
        assert.ok(html.includes('원고와 설정이 바뀌었는지 확인하고 있어요.'))
        assert.ok(html.includes('role="status"'))
        assert.ok(!html.includes('후보가 없어요.'))
        assert.ok(!html.includes('후보를 찾아 드려요.'))
      }
    }
  } finally { await server.close() }
})
