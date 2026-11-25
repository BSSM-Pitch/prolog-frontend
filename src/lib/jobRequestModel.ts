/** Single-flight requests, including replies that already contain a finished job. */
export function createJobRequest<T>({ onBusy, onResult, onError }: {
  onBusy: (busy: boolean) => void
  onResult: (result: T) => void
  onError: (error: unknown) => void
}) {
  let busy = false
  let generation = 0
  return {
    async run(request: () => Promise<T | null>) {
      if (busy) return
      busy = true
      const current = ++generation
      onBusy(true)
      try {
        const result = await request()
        if (current === generation && result !== null) onResult(result)
      } catch (error) {
        if (current === generation) onError(error)
      } finally {
        if (current === generation) { busy = false; onBusy(false) }
      }
    },
    // Navigation stops observing a response; the server job remains durable.
    reset() { generation++; busy = false },
  }
}
