import { useState } from 'react'
import { ApiError } from '../../api/client'
import { IS_REAL } from '../../api/config'
import * as api from '../../api/notifications'
import type { EmailIntegration, NotificationSetting } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Toggle } from '../../components/Toggle'
import { describeError, mockOAuthCode } from '../../lib/errors'
import { shortDate } from '../../lib/relativeTime'
import { useResource } from '../../lib/useResource'
import '../world/world.css'
import { NOTIFICATION_LABEL, PROVIDERS } from './labels'
import './notifications.css'

// Figma 1261:2820 · 31 알림 설정
export function NotificationSettingsPage() {
  const { withAuth } = useSession()
  const settings = useResource(api.getSettings, [])
  const integrations = useResource(api.listEmailIntegrations, [])
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState<EmailIntegration | null>(null)
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState<string | null>(null)

  // real 모드: 백엔드에 이메일 연동이 없다. 이메일 설정은 저장만 되므로 스위치는 그대로 쓰게 둔다
  const hasEmail = IS_REAL || (integrations.data ?? []).length > 0

  // 바꾼 설정은 바로 저장한다 (낙관적 갱신 후 실패하면 되돌림)
  async function change(s: NotificationSetting, field: 'in_app_enabled' | 'email_enabled', value: boolean) {
    const key = `${s.type}.${field}`
    setError(null)
    setSaving(key)
    settings.setData((prev) => prev?.map((x) => (x.type === s.type ? { ...x, [field]: value } : x)) ?? prev)
    try {
      const saved = await withAuth((t) => api.updateSetting(t, { type: s.type, [field]: value }))
      settings.setData((prev) => prev?.map((x) => (x.type === saved.type ? saved : x)) ?? prev)
    } catch (e) {
      settings.setData((prev) => prev?.map((x) => (x.type === s.type ? s : x)) ?? prev)
      setError(describeError(e))
    } finally {
      setSaving(null)
    }
  }

  async function connect(provider: EmailIntegration['provider']) {
    setError(null)
    setConflict(null)
    setConnecting(provider)
    try {
      // 실제로는 Google·네이버 인가 화면을 거쳐 받은 code를 보낸다
      const linked = await withAuth((t) => api.connectEmail(t, provider, mockOAuthCode(provider)))
      integrations.setData((prev) => [...(prev ?? []), linked])
    } catch (e) {
      if (e instanceof ApiError && e.code === 'EMAIL_ALREADY_CONNECTED') setConflict(provider)
      else setError(describeError(e))
    } finally {
      setConnecting(null)
    }
  }

  async function unlink() {
    if (!unlinking) return
    setBusy(true)
    try {
      await withAuth((t) => api.disconnectEmail(t, unlinking.integration_id))
      integrations.setData((prev) => prev?.filter((x) => x.integration_id !== unlinking.integration_id) ?? prev)
      setUnlinking(null)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="noti">
      <header>
        <p className="page-crumb">설정 / 알림</p>
        <h1 className="page-title">알림 설정</h1>
        <p className="page-desc">알림 유형마다 받을 곳을 정하세요.</p>
      </header>

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      <div className="noti__layout">
        <section className="panel" aria-labelledby="per-type-title">
          <h2 id="per-type-title" className="panel__title">
            알림 유형별 받기
          </h2>
          {settings.error && !settings.data && <p className="notice notice--error">{settings.error}</p>}
          <table className="noti__table">
            <thead>
              <tr>
                <th scope="col">유형</th>
                <th scope="col">서비스 알림</th>
                <th scope="col">이메일</th>
              </tr>
            </thead>
            <tbody>
              {(settings.data ?? []).map((s) => (
                <tr key={s.type}>
                  <th scope="row">
                    <span className="noti__channel-name">{NOTIFICATION_LABEL[s.type].title}</span>
                    <span className="panel__label">{NOTIFICATION_LABEL[s.type].when}</span>
                  </th>
                  <td>
                    <Toggle checked={s.in_app_enabled} onChange={(v) => change(s, 'in_app_enabled', v)} label={`${NOTIFICATION_LABEL[s.type].title} 서비스 알림`} busy={saving === `${s.type}.in_app_enabled`} />
                  </td>
                  <td>
                    <Toggle
                      checked={s.email_enabled && hasEmail}
                      onChange={(v) => change(s, 'email_enabled', v)}
                      label={`${NOTIFICATION_LABEL[s.type].title} 이메일 알림`}
                      disabled={!hasEmail}
                      busy={saving === `${s.type}.email_enabled`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="panel__label">
            {IS_REAL ? '바꾼 설정은 바로 저장돼요. 이메일 알림은 아직 보내지 않고 설정만 저장해 둬요.' : '바꾼 설정은 바로 저장돼요. 이메일 계정이 연동되어 있지 않으면 이메일 알림은 보내지 않아요.'}
          </p>
        </section>

        <aside className="panel noti__side" aria-labelledby="email-title">
          <h2 id="email-title" className="panel__title">
            이메일 연동
          </h2>
          {IS_REAL && <p className="page-desc">이메일 계정 연동은 아직 지원하지 않아요.</p>}
          {!IS_REAL && PROVIDERS.map(({ provider, name }) => {
            const linked = integrations.data?.find((i) => i.provider === provider)
            return (
              <div key={provider} className="noti__channel">
                <div>
                  <p className="noti__channel-name">
                    {name} <span className={linked ? 'badge badge--success' : 'badge badge--filled'}>{linked ? '연동됨' : '연동 안 됨'}</span>
                  </p>
                  <p className="panel__label">{linked ? `${linked.email_address} · ${shortDate(linked.connected_at)} 연동` : '연동하면 이메일로도 알림을 받을 수 있어요'}</p>
                </div>
                {linked ? (
                  <Button tone="outline" onClick={() => setUnlinking(linked)}>
                    연동 해제
                  </Button>
                ) : (
                  <Button tone="soft" onClick={() => connect(provider)} busy={connecting === provider}>
                    연동하기
                  </Button>
                )}
              </div>
            )
          })}
          {conflict && (
            <div className="notice notice--error noti__alert" role="alert">
              <strong>서비스마다 계정은 하나만 연동할 수 있어요</strong>
              <span>다른 {PROVIDERS.find((p) => p.provider === conflict)?.name} 계정으로 바꾸려면 먼저 연동을 해제해 주세요.</span>
            </div>
          )}
          {!IS_REAL && <p className="panel__label">서비스마다 계정은 하나만 연동할 수 있어요. 다른 계정으로 바꾸려면 먼저 연동을 해제해 주세요.</p>}
        </aside>
      </div>

      {unlinking && (
        <ConfirmDialog
          title={`${PROVIDERS.find((p) => p.provider === unlinking.provider)?.name} 연동을 해제할까요?`}
          body={`앞으로 이 주소(${unlinking.email_address})로는 알림 메일을 보내지 않아요. 서비스 알림은 그대로 받아요.`}
          confirmLabel="연동 해제"
          busy={busy}
          onConfirm={unlink}
          onCancel={() => setUnlinking(null)}
        />
      )}
    </div>
  )
}
