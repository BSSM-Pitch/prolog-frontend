// 백엔드의 추출기가 지원하는 형식과 맞춘다.
export const MANUSCRIPT_FORMATS = ['docx', 'txt']
export const MANUSCRIPT_ACCEPT = MANUSCRIPT_FORMATS.map((format) => `.${format}`).join(',')
export const MAX_MANUSCRIPT_BYTES = 20 * 1024 * 1024

export interface ManuscriptUpload {
  key: string
  file: File
  status: 'queued' | 'uploading' | 'uploaded' | 'failed'
  manuscriptId?: string
  error?: string
}

export function validateManuscriptFile(file: File): string | null {
  if (!MANUSCRIPT_FORMATS.includes(file.name.split('.').pop()?.toLowerCase() ?? '')) return 'DOCX · TXT 파일만 올릴 수 있어요.'
  if (file.size === 0) return '빈 파일은 올릴 수 없어요.'
  if (file.size > MAX_MANUSCRIPT_BYTES) return '파일당 20MB까지 올릴 수 있어요.'
  return null
}

export function appendManuscriptFiles(current: ManuscriptUpload[], files: File[]) {
  const items = [...current]
  const errors: string[] = []
  const keys = new Set(current.map((item) => item.key))
  for (const file of files) {
    const error = validateManuscriptFile(file)
    if (error) {
      errors.push(`${file.name}: ${error}`)
      continue
    }
    const key = JSON.stringify([file.name, file.size, file.lastModified])
    if (keys.has(key)) continue
    keys.add(key)
    items.push({ key, file, status: 'queued' })
  }
  return { items, errors }
}

interface UploadActions {
  create: (file: File) => Promise<string>
  upload: (manuscriptId: string, file: File) => Promise<void>
  describeError: (error: unknown) => string
  changed: (items: ManuscriptUpload[]) => void
}

/** 파일 하나가 실패해도 다음 파일을 처리하고, 재시도에는 이미 만든 원고를 쓴다. */
export async function runManuscriptUploads(current: ManuscriptUpload[], actions: UploadActions, onlyKey?: string) {
  let items = current.map((item) => ({ ...item }))
  function update(key: string, patch: Partial<ManuscriptUpload>) {
    items = items.map((item) => item.key === key ? { ...item, ...patch } : item)
    actions.changed(items)
  }
  for (const item of current) {
    if (item.status === 'uploaded' || item.status === 'uploading' || (onlyKey && item.key !== onlyKey)) continue
    update(item.key, { status: 'uploading', error: undefined })
    try {
      const manuscriptId = item.manuscriptId ?? await actions.create(item.file)
      // 파일 전송 전에 ID를 보관해야 전송 실패 후 원고가 중복 생성되지 않는다.
      update(item.key, { manuscriptId })
      await actions.upload(manuscriptId, item.file)
      update(item.key, { status: 'uploaded' })
    } catch (error) {
      update(item.key, { status: 'failed', error: actions.describeError(error) })
    }
  }
  return items
}
