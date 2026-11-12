import { useState } from 'react'
import { Button } from './Button'
import './ui.css'

/**
 * 초대 수락 링크. 백엔드는 초대 메일을 아직 보내지 않고, 수락에는 생성 응답의 토큰이 필요하다(CLAUDE.md §6.4).
 * 초대한 사람이 이 링크를 직접 전해 준다.
 */
export function InviteLink({ url, compact }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  // 클립보드를 쓸 수 없으면 링크를 선택해 둔 입력창을 보여 줘서 직접 복사하게 한다
  const [manual, setManual] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setManual(false)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setManual(true)
    }
  }
  if (compact) {
    return (
      <>
        <Button tone="soft" onClick={copy}>
          {copied ? '복사했어요' : '링크 복사'}
        </Button>
        {manual && <ManualCopy url={url} />}
      </>
    )
  }
  return (
    <div className="invite-link">
      <input className="invite-link__url" value={url} readOnly aria-label="초대 링크" onFocus={(e) => e.currentTarget.select()} />
      <Button tone="soft" onClick={copy}>
        {copied ? '복사했어요' : '링크 복사'}
      </Button>
      {manual && <ManualCopy url={url} />}
      <p className="panel__label">초대받은 사람이 이 링크를 열고 로그인하면 참가할 수 있어요. 링크는 7일 동안 쓸 수 있어요.</p>
    </div>
  )
}

function ManualCopy({ url }: { url: string }) {
  return (
    <div className="invite-link" role="status">
      <input
        className="invite-link__url"
        value={url}
        readOnly
        autoFocus
        aria-label="복사할 초대 링크"
        onFocus={(e) => e.currentTarget.select()}
      />
      <p className="panel__label">자동 복사가 안 돼요. 선택된 링크를 Ctrl+C(맥은 ⌘+C)로 복사해 주세요.</p>
    </div>
  )
}
