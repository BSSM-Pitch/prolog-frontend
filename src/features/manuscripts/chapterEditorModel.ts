import type { Chapter } from '../../api/types'

/** An explicit missing target must never silently open a different chapter. */
export function selectedChapter(chapters: Chapter[], requested: string | null): Chapter | null {
  if (requested !== null) {
    const no = Number(requested)
    return Number.isInteger(no) && no > 0 ? (chapters.find((c) => c.chapter_no === no) ?? null) : null
  }
  return chapters[chapters.length - 1] ?? null
}

/** A slow list response must not hide a chapter already confirmed by POST. */
export function withCreatedChapters(server: Chapter[], created: Record<string, Chapter>): Chapter[] {
  const all = new Map(server.map((chapter) => [chapter.chapter_id, chapter]))
  for (const chapter of Object.values(created)) if (!all.has(chapter.chapter_id)) all.set(chapter.chapter_id, chapter)
  return [...all.values()].sort((a, b) => a.chapter_no - b.chapter_no)
}

type PendingSave = { chapterId: string; content: string }

/** Preserve each chapter's pending edit even when browser navigation bypasses the selector. */
export class ChapterSaveQueue {
  private pending = new Map<string, string>()
  private running: Promise<boolean> | null = null

  get dirty() {
    return this.pending.size > 0 || this.running !== null
  }
  enqueue(chapterId: string, content: string) {
    this.pending.set(chapterId, content)
  }

  async flush(save: (job: PendingSave) => Promise<void>): Promise<boolean> {
    if (this.running) {
      if (!(await this.running)) return false
      return this.pending.size ? this.flush(save) : true
    }
    if (!this.pending.size) return true
    this.running = this.drain(save)
    try {
      return await this.running
    } finally {
      this.running = null
    }
  }

  private async drain(save: (job: PendingSave) => Promise<void>): Promise<boolean> {
    while (this.pending.size) {
      const [chapterId, content] = this.pending.entries().next().value!
      this.pending.delete(chapterId)
      try {
        await save({ chapterId, content })
      } catch {
        // Keep newer edits made while the failed request was in flight.
        if (!this.pending.has(chapterId)) this.pending.set(chapterId, content)
        return false
      }
    }
    return true
  }
}
