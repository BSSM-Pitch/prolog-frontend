import { useRef, useState } from 'react'
import * as api from '../../api/manuscripts'
import { useSession } from '../../auth/session'
import { describeError } from '../../lib/errors'
import { appendManuscriptFiles, runManuscriptUploads, type ManuscriptUpload } from './manuscriptUploadModel'

export function useManuscriptUploads() {
  const { withAuth } = useSession()
  const [items, setItems] = useState<ManuscriptUpload[]>([])
  const current = useRef(items)
  const locked = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [pickErrors, setPickErrors] = useState<string[]>([])

  function change(next: ManuscriptUpload[]) {
    current.current = next
    setItems(next)
  }

  function pick(files: File[]) {
    if (locked.current) return
    const result = appendManuscriptFiles(current.current, files)
    change(result.items)
    setPickErrors(result.errors)
  }

  function remove(key: string) {
    if (locked.current) return
    change(current.current.filter((item) => item.key !== key || Boolean(item.manuscriptId)))
  }

  function clear() {
    if (locked.current) return
    change([])
    setPickErrors([])
  }

  function clearUploaded() {
    if (locked.current) return
    // 완료한 파일의 바이트는 놓아주고, 실패한 파일만 재시도를 위해 보관한다.
    change(current.current.filter((item) => item.status !== 'uploaded'))
  }

  async function upload(projectId: string, onlyKey?: string, onUploaded?: (id: string) => void) {
    if (locked.current) return null
    locked.current = true
    setUploading(true)
    try {
      return await runManuscriptUploads(current.current, {
        create: async (file) => (await withAuth((token) => api.createManuscript(token, projectId, {
          title: file.name.replace(/\.[^.]+$/, '').slice(0, 200) || '새 원고',
          source_type: 'file',
        }))).manuscript_id,
        upload: async (id, file) => {
          await withAuth((token) => api.uploadManuscriptFile(token, projectId, id, file))
          onUploaded?.(id)
        },
        describeError,
        changed: change,
      }, onlyKey)
    } finally {
      locked.current = false
      setUploading(false)
    }
  }

  return { items, uploading, pickErrors, pick, remove, clear, clearUploaded, upload }
}
