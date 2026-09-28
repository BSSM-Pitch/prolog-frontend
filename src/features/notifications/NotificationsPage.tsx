import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import * as membersApi from '../../api/members'
import * as api from '../../api/notifications'
import * as teamsApi from '../../api/teams'
import type { Notification, NotificationType } from '../../api/types'
import { useSession } from '../../auth/session'
import { Button } from '../../components/Button'
import { describeError } from '../../lib/errors'
import { relativeTime } from '../../lib/relativeTime'
import { useResource } from '../../lib/useResource'
import '../characters/characters.css'
import '../world/world.css'
import { notifyTeamsChanged } from '../teams/teamEvents'
import { NOTIFICATION_LABEL, NOTIFICATION_TYPES, PROVIDERS, notifyNotificationsChanged } from './labels'
import './notifications.css'

const DAY = 86_400_000
const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY))

/** 목록 오른쪽 위의 시각. 대기 중인 초대는 남은 기한을 보여 준다 (Figma 30 "만료까지 6일") */
function whenOf(n: Notification) {
  const ref = n.related_ref
  if (ref?.status === 'pending' && ref.expires_at) return `만료까지 ${daysLeft(ref.expires_at)}일`
  return relativeTime(n.created_at)
}

/** 알림이 가리키는 화면 */
function linkOf(n: Notification): string | null {
  const ref = n.related_ref
  if (!ref) return null
  if (ref.type === 'team' || ref.type === 'team_invitation') return ref.type === 'team' ? `/teams/${ref.id}` : ref.status === 'accepted' ? `/teams/${ref.parent_id}` : null
  if (ref.type === 'project' || ref.type === 'project_invitation') return ref.type === 'project' ? `/projects/${ref.id}` : ref.status === 'accepted' ? `/projects/${ref.parent_id}` : null
  return null
}

// Figma 1261:2571 · 30 알림
export function NotificationsPage() {
  const navigate = useNavigate()
  const { withAuth } = useSession()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [type, setType] = useState<NotificationType | ''>('')
  const first = useResource((t) => api.listNotifications(t, { unread_only: unreadOnly, type }), [unreadOnly, type])
  const settings = useResource(api.getSettings, [])
  const integrations = useResource(api.listEmailIntegrations, [])

  // 더 불러온 알림과 화면에서 바꾼 알림(읽음·참가·삭제)
  const [more, setMore] = useState<{ key: string; items: Notification[]; cursor: string | null } | null>(null)
  const [patched, setPatched] = useState<Record<string, Notification | null>>({})
  const [unreadDelta, setUnreadDelta] = useState<{ key: string; n: number }>({ key: '', n: 0 })
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [itemError, setItemError] = useState<{ id: string; message: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const key = `${unreadOnly}|${type}`
  const extra = more?.key === key ? more : null
  const items = [...(first.data?.data ?? []), ...(extra?.items ?? [])]
    .map((n) => (n.notification_id in patched ? patched[n.notification_id] : n))
    .filter((n): n is Notification => n !== null)
  const cursor = extra ? extra.cursor : (first.data?.meta.next_cursor ?? null)
  const unread = Math.max(0, (first.data?.meta.unread_count ?? 0) + (unreadDelta.key === key ? unreadDelta.n : 0))

  function patch(n: Notification, next: Notification | null) {
    setPatched((p) => ({ ...p, [n.notification_id]: next }))
    const was = !n.read_at
    const now = next ? !next.read_at : false
    if (was !== now) setUnreadDelta((d) => ({ key, n: (d.key === key ? d.n : 0) + (now ? 1 : -1) }))
    notifyNotificationsChanged()
  }

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const res = await withAuth((t) => api.listNotifications(t, { unread_only: unreadOnly, type, cursor }))
      setMore({ key, items: [...(extra?.items ?? []), ...res.data], cursor: res.meta.next_cursor })
    } catch (e) {
      setError(describeError(e))
    } finally {
      setLoadingMore(false)
    }
  }

  async function markAll() {
    setError(null)
    try {
      await withAuth(api.markAllRead)
      setPatched({})
      setMore(null)
      setUnreadDelta({ key: '', n: 0 })
      first.reload()
      notifyNotificationsChanged()
    } catch (e) {
      setError(describeError(e))
    }
  }

  async function act(n: Notification, fn: () => Promise<Notification | null>) {
    setBusyId(n.notification_id)
    setItemError(null)
    try {
      patch(n, await fn())
    } catch (e) {
      const message = e instanceof ApiError && e.code === 'INVITATION_EXPIRED' ? '만료된 초대예요. 초대한 사람에게 다시 요청해 주세요.' : describeError(e)
      setItemError({ id: n.notification_id, message })
    } finally {
      setBusyId(null)
    }
  }

  // 초대 수락: TEAM 4.9 / PRJ 4.8 → 알림은 읽음으로
  const join = (n: Notification) =>
    act(n, async () => {
      const ref = n.related_ref!
      await withAuth<unknown>((t) =>
        ref.type === 'team_invitation' ? teamsApi.acceptTeamInvitation(t, ref.parent_id!, ref.id) : membersApi.acceptInvitation(t, ref.parent_id!, ref.id),
      )
      if (ref.type === 'team_invitation') notifyTeamsChanged()
      const read = await withAuth((t) => api.markRead(t, n.notification_id))
      return { ...read, related_ref: { ...ref, status: 'accepted' } }
    })

  const toggleRead = (n: Notification) => act(n, () => withAuth((t) => api.markRead(t, n.notification_id, !n.read_at)))
  const remove = (n: Notification) => act(n, async () => (await withAuth((t) => api.deleteNotification(t, n.notification_id)), null))

  async function open(n: Notification, to: string) {
    if (!n.read_at) await act(n, () => withAuth((t) => api.markRead(t, n.notification_id)))
    navigate(to)
  }

  const inAppOn = (settings.data ?? []).filter((s) => s.in_app_enabled).length
  const allTypes = settings.data?.length ?? NOTIFICATION_TYPES.length

  return (
    <div className="noti">
      <header className="world__header">
        <div>
          <h1 className="page-title">알림</h1>
          <p className="page-desc">초대와 멘션, 시스템 소식을 확인하세요.</p>
        </div>
        <div className="actions-row">
          <Button tone="outline" onClick={markAll} disabled={unread === 0}>
            모두 읽음으로 표시
          </Button>
          <Link className="btn btn--secondary" to="/settings/notifications">
            알림 설정
          </Link>
        </div>
      </header>

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      <div className="noti__layout">
        <section className="panel" aria-label="알림 목록">
          <div className="noti__filters">
            <div className="segmented" role="radiogroup" aria-label="읽음 여부">
              <button type="button" role="radio" aria-checked={!unreadOnly} onClick={() => setUnreadOnly(false)}>
                전체
              </button>
              <button type="button" role="radio" aria-checked={unreadOnly} onClick={() => setUnreadOnly(true)}>
                안 읽음 {unread}
              </button>
            </div>
            <select className="nl-select" value={type} onChange={(e) => setType(e.target.value as NotificationType | '')} aria-label="알림 유형">
              <option value="">모든 유형</option>
              {NOTIFICATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {NOTIFICATION_LABEL[t].title}
                </option>
              ))}
            </select>
          </div>

          {first.error && !first.data && <p className="notice notice--error">{first.error}</p>}
          {first.data && items.length === 0 && (
            <div className="state-block">
              <p className="panel__title">{unreadOnly ? '안 읽은 알림이 없어요' : '받은 알림이 없어요'}</p>
              <p className="page-desc">팀이나 프로젝트에 초대받으면 이곳에 알려 드려요.</p>
            </div>
          )}

          <ul className="noti__list">
            {items.map((n) => {
              const ref = n.related_ref
              const invite = ref && (ref.type === 'team_invitation' || ref.type === 'project_invitation')
              const to = linkOf(n)
              const busy = busyId === n.notification_id
              return (
                <li key={n.notification_id} className={n.read_at ? 'noti__item' : 'noti__item is-unread'}>
                  <div className="noti__head">
                    <span className={invite ? 'badge badge--done' : 'badge badge--filled'}>{NOTIFICATION_LABEL[n.type].title}</span>
                    <span className="panel__label">{whenOf(n)}</span>
                    {!n.read_at && <span className="noti__dot" aria-label="안 읽음" />}
                  </div>
                  <p className="noti__body">
                    {to ? (
                      <button type="button" className="noti__link" onClick={() => open(n, to)}>
                        {n.body}
                      </button>
                    ) : (
                      n.body
                    )}
                  </p>
                  {itemError?.id === n.notification_id && <p className="notice notice--error">{itemError.message}</p>}
                  <div className="noti__actions">
                    {invite && ref.status === 'pending' && (
                      <Button onClick={() => join(n)} busy={busy}>
                        참가
                      </Button>
                    )}
                    {invite && ref.status === 'accepted' && <span className="badge badge--success">참가함</span>}
                    {invite && (ref.status === 'expired' || ref.status === 'revoked') && <span className="badge badge--filled">{ref.status === 'expired' ? '만료된 초대' : '취소된 초대'}</span>}
                    <button type="button" className="text-link" onClick={() => toggleRead(n)} disabled={busy}>
                      {n.read_at ? '안 읽음으로' : '읽음으로'}
                    </button>
                    <button type="button" className="text-link" onClick={() => remove(n)} disabled={busy}>
                      삭제
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          {cursor && (
            <Button tone="soft" onClick={loadMore} busy={loadingMore}>
              더 보기
            </Button>
          )}
        </section>

        <aside className="panel noti__side" aria-labelledby="channels-title">
          <h2 id="channels-title" className="panel__title">
            받는 방법
          </h2>
          <div className="noti__channel">
            <div>
              <p className="noti__channel-name">서비스 알림</p>
              <p className="panel__label">{inAppOn === allTypes ? '켜짐 · 유형별로 끌 수 있어요' : `${allTypes}개 유형 중 ${inAppOn}개 켜짐`}</p>
            </div>
            <span className={inAppOn > 0 ? 'badge badge--success' : 'badge badge--filled'}>{inAppOn > 0 ? '켜짐' : '꺼짐'}</span>
          </div>
          {PROVIDERS.map(({ provider, name }) => {
            const linked = integrations.data?.find((i) => i.provider === provider)
            return (
              <div key={provider} className="noti__channel">
                <div>
                  <p className="noti__channel-name">{name}</p>
                  <p className="panel__label">{linked ? linked.email_address : '연동하면 이메일로도 받을 수 있어요'}</p>
                </div>
                <span className={linked ? 'badge badge--success' : 'badge badge--filled'}>{linked ? '연동됨' : '연동 안 됨'}</span>
              </div>
            )
          })}
          <Link className="btn btn--outline" to="/settings/notifications">
            알림 설정 열기
          </Link>
        </aside>
      </div>
    </div>
  )
}
