/** Only a job ID is remembered; the manuscript text and result stay on the server. */
export function extractionRecoveryKey(userId: string, projectId: string, targetId: string) {
  return `prolog:nl-extraction:${userId}:${projectId}:${targetId || 'new'}`
}
export function recalledExtraction(storage: Pick<Storage, 'getItem'>, key: string): string | null {
  try { return storage.getItem(key) || null } catch { return null }
}
export function rememberExtraction(storage: Pick<Storage, 'setItem' | 'removeItem'>, key: string, id: string | null) {
  try { if (id) storage.setItem(key, id); else storage.removeItem(key) } catch { /* Server history remains available. */ }
}
