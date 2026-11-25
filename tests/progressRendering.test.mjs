import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
test('only measured work renders a progress bar and the displayed percentage uses actual counts', async () => {
  const server = await createServer({ server: { middlewareMode: true } })
  try {
    const { AnalysisProgress } = await server.ssrLoadModule('/src/components/AnalysisProgress.tsx')
    for (const props of [{}, { completed: 1 }, { total: 0, completed: 0 }, { total: Infinity, completed: 3 }]) {
      assert.ok(!renderToStaticMarkup(h(AnalysisProgress, props)).includes('<progress'))
    }
    const html = renderToStaticMarkup(h(AnalysisProgress, { completed: 3, total: 4, label: '원문 검증' }))
    assert.match(html, /75%/)
    assert.match(html, /max="4" value="3"/)
    assert.ok(!html.includes('indeterminate'))
  } finally { await server.close() }
})
