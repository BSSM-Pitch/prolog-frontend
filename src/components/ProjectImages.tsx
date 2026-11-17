import { useRef, useState } from 'react'
import * as api from '../api/media'
import { useSession } from '../auth/session'
import { describeError } from '../lib/errors'
import './projectImages.css'

export function Avatar({ name, src }: { name: string; src?: string }) {
  const [broken, setBroken] = useState<string | null>(null)
  return (
    <span className="character-avatar" aria-hidden="true">
      {src && broken !== src ? <img src={src} alt="" onError={() => setBroken(src)} /> : name.slice(0, 1)}
    </span>
  )
}
export function ProjectCover({ title, src }: { title: string; src?: string }) {
  const [broken, setBroken] = useState<string | null>(null)
  const tone = [...title].reduce((n, c) => n + c.charCodeAt(0), 0) % 5
  return (
    <div className={`project-cover project-cover--${tone}`}>
      {src && broken !== src ? (
        <img src={src} alt={`${title} 표지`} onError={() => setBroken(src)} />
      ) : (
        <>
          <span>PROLOG</span>
          <strong>{title}</strong>
          <span>한 장씩, 나만의 이야기</span>
        </>
      )}
    </div>
  )
}

export function ImagePicker({
  projectId,
  targetId,
  kind,
  current,
  onChanged,
}: {
  projectId: string
  targetId: string
  kind: api.ProjectImage['kind']
  current?: api.ProjectImage
  onChanged: () => void
}) {
  const { withAuth } = useSession()
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const label = kind === 'cover' ? '작품 표지' : '인물 사진'
  async function change(file?: File) {
    if (lock.current) return
    if (file && file.size > 5 * 1024 * 1024) {
      setError('이미지는 5MB 이하로 선택해 주세요.')
      return
    }
    lock.current = true
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (file) await withAuth((token) => api.uploadImage(token, projectId, kind, targetId, file))
      else await withAuth((token) => api.removeImage(token, projectId, kind, targetId))
      setMessage(file ? `${label}${kind === 'cover' ? '를' : '을'} 저장했어요.` : '기본 이미지로 변경했어요.')
      onChanged()
      window.dispatchEvent(new CustomEvent('project-image-changed', { detail: projectId }))
    } catch (e) {
      setError(describeError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <div className="image-picker">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        aria-label={`${label} 파일`}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (file) void change(file)
        }}
      />
      <button className="text-link" type="button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? '저장 중…' : `${label} ${current ? '변경' : '등록'}`}
      </button>
      {current && (
        <button className="text-link" type="button" disabled={busy} onClick={() => void change()}>
          기본 이미지로
        </button>
      )}
      <small>JPG · PNG · WebP, 최대 5MB</small>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
