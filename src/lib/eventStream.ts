/** Incremental SSE decoder: UTF-8, split frames and reconnect snapshots stay intact. */
export async function readEvents(body: ReadableStream<Uint8Array>, receive: (value: unknown) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      pending += decoder.decode(value, { stream: true })
      pending = pending.replace(/\r\n/g, '\n')
      let end: number
      while ((end = pending.indexOf('\n\n')) >= 0) {
        const frame = pending.slice(0, end)
        pending = pending.slice(end + 2)
        const data = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
        if (data) receive(JSON.parse(data))
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
