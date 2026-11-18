import { ApiError } from './client'
import { API_BASE_URL } from './config'

/** Binary requests keep the same authentication/error contract as JSON requests. */
export async function fileRequest(
  token: string,
  path: string,
  method = 'GET',
  body?: File,
): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': body.type || 'application/octet-stream' } : {}),
      },
      body,
    })
  } catch {
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: '서버에 연결하지 못했어요. 다시 시도해 주세요.',
      details: {},
    })
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(
      response.status,
      data?.error ?? {
        code: 'FILE_ERROR',
        message: '파일을 처리하지 못했어요. 다시 시도해 주세요.',
        details: {},
      },
    )
  }
  return response
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  // Filenames cannot contain control characters on supported desktop platforms.
  // eslint-disable-next-line no-control-regex
  link.download = filename.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
