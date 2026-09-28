import { useState } from 'react'
import { Button } from './Button'
import './ui.css'

/**
 * 초대 수락 링크. 백엔드는 초대 메일을 아직 보내지 않고, 수락에는 생성 응답의 토큰이 필요하다(CLAUDE.md §6.4).
 * 초대한 사람이 이 링크를 직접 전해 준다.
 */
export function InviteLink({ url, compact }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('초대 링크를 복사해 주세요', url)
    }
  }
  if (compact) {
    return (
      <Button tone="soft" onClick={copy}>
        {copied ? '복사했어요' : '링크 복사'}
      </Button>
    )
  }
  return (
    <div className="invite-link">
      <input className="invite-link__url" value={url} readOnly aria-label="초대 링크" onFocus={(e) => e.currentTarget.select()} />
      <Button tone="soft" onClick={copy}>
        {copied ? '복사했어요' : '링크 복사'}
      </Button>
      <p className="panel__label">초대받은 사람이 이 링크를 열고 로그인하면 참가할 수 있어요. 링크는 7일 동안 쓸 수 있어요.</p>
    </div>
  )
}
