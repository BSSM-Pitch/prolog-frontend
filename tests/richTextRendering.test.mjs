import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
test('AI prose renders headings, lists, tables and code safely', async () => {
  const server = await createServer({ server: { middlewareMode: true } })
  try {
    const { RichText } = await server.ssrLoadModule('/src/components/RichText.tsx')
    const source = '# 제목\n\n**굵게** *기울임*\n\n1. 첫째\n2. 둘째\n\n> 인용\n\n| 인물 | 역할 |\n|---|---|\n| 아린 | 주인공 |\n\n```js\nconst a = "<원문>"\n```\n\n[위험](javascript:alert(1))\n\n<img src=x onerror=alert(1)>\n\n![외부](https://tracker.example/pixel)'
    const html = renderToStaticMarkup(createElement(RichText, null, source))
    for (const fragment of ['<h1>제목</h1>', '<strong>굵게</strong>', '<em>기울임</em>', '<ol>', '<blockquote>', '<table>', '<thead>', '<pre>', '&lt;원문&gt;']) assert.ok(html.includes(fragment), fragment)
    assert.ok(!html.includes('href="javascript:'))
    assert.ok(!html.includes('<img'))
    assert.ok(!html.includes('onerror='))
  } finally { await server.close() }
})
