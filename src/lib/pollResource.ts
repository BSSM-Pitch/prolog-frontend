/** A screen may stop observing a durable server job without cancelling the job itself. */
export function pollResource<T>({ load, onValue, onError, delay }: {
  load: () => Promise<T>
  onValue: (value: T) => void
  onError: (error: unknown) => void
  delay: (value: T | undefined) => number
}) {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let previous: T | undefined
  async function read() {
    try {
      const value = await load()
      if (stopped) return
      previous = value
      onValue(value)
    } catch (error) {
      if (stopped) return
      onError(error)
    }
    if (!stopped) timer = setTimeout(read, delay(previous))
  }
  void read()
  return () => { stopped = true; clearTimeout(timer) }
}
