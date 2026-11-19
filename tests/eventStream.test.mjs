import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readEvents } from '../src/lib/eventStream.ts'

test('SSE preserves Korean split across UTF-8 chunks and reconnect snapshots', async () => {
  const bytes = new TextEncoder().encode(': heartbeat\n\nevent: message\ndata: {"preview_content":"윤하\\n등불","status":"pending"}\n\nevent: message\ndata: {"content":"완료","status":"completed"}\n\n')
  const messages = []
  const body = new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i++) controller.enqueue(bytes.slice(i, i + 1))
    controller.close()
  } })
  await readEvents(body, (m) => messages.push(m))
  assert.deepEqual(messages, [{ preview_content: '윤하\n등불', status: 'pending' }, { content: '완료', status: 'completed' }])
})
