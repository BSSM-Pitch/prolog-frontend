import { useState, type ComponentType, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  IconAffiliate,
  IconBell,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFileCheck,
  IconHome,
  IconLogout,
  IconNotebook,
  IconSettings,
  IconUsersGroup,
  type IconProps,
} from '@tabler/icons-react'
import * as notificationsApi from '../../api/notifications'
import * as teamsApi from '../../api/teams'
import type { Project } from '../../api/types'
import { useSession } from '../../auth/session'
import { ROLE_OPTIONS } from '../../lib/roles'
import { useResource } from '../../lib/useResource'
import { useNotificationsChanged } from '../notifications/labels'
import { useTeamsChanged } from '../teams/teamEvents'
import { projectPath } from './currentProject'

type Icon = ComponentType<IconProps>

interface SidebarProps {
  /** 열려 있는 프로젝트. 없으면 프로젝트 전용 메뉴를 비활성으로 둔다 */
  project: Project | null
  collapsed: boolean
  onToggle: () => void
}

type SubItem = { label: string; sub: string; /** 아직 열지 않은 화면 — 메뉴에는 보이지만 들어갈 수 없다 */ disabled?: boolean }

const REVIEW_ITEMS: SubItem[] = [
  { label: '세계관 설정', sub: 'rules' },
  { label: '설정 충돌', sub: 'conflicts' },
]
const DESIGN_ITEMS: SubItem[] = [
  { label: '캐릭터 분석', sub: 'characters' },
  { label: '관계 변화 그래프', sub: 'relationships', disabled: true },
  { label: '복선 추적', sub: 'foreshadowings', disabled: true },
  { label: '스토리 맵', sub: 'story-map', disabled: true },
]

// Figma 915:2343 Sidebar (Default / Close)
export function Sidebar({ project, collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, signOut } = useSession()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const teams = useResource(user ? teamsApi.listTeams : null, [user?.user_id])
  useTeamsChanged(teams.reload)
  // 최근 알림 3개와 안 읽은 수. 화면을 옮길 때마다 새로 확인한다 (명세에 실시간 채널 없음)
  const recent = useResource(user ? (t) => notificationsApi.listNotifications(t, { limit: 3 }) : null, [user?.user_id, pathname])
  useNotificationsChanged(recent.reload)
  const unread = recent.data?.meta.unread_count ?? 0
  if (!user) return null

  const roleTitle = ROLE_OPTIONS.find((r) => r.value === user.role)?.title ?? ''
  const disabledReason = project ? undefined : '프로젝트를 열면 쓸 수 있어요'
  const toProject = (sub = '') => (project ? projectPath(project.project_id, sub) : '')
  const inGroup = (items: typeof REVIEW_ITEMS) => Boolean(project) && items.some((i) => pathname.startsWith(toProject(i.sub)))
  // 하위 화면에 있으면 그룹을 펼친 상태로 시작한다
  const isOpen = (key: string, items?: typeof REVIEW_ITEMS) => open[key] ?? (items ? inGroup(items) : false)
  const toggle = (key: string, items?: typeof REVIEW_ITEMS) => setOpen((o) => ({ ...o, [key]: !isOpen(key, items) }))

  async function onLogout() {
    await signOut()
    navigate('/auth/login', { replace: true })
  }

  return (
    <aside className={collapsed ? 'sidebar sidebar--collapsed' : 'sidebar'} aria-label="주 메뉴">
      <button
        type="button"
        className="sidebar__collapse"
        onClick={onToggle}
        aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
      </button>

      <NavLink to="/projects" end className="sidebar__profile" title="내 프로젝트">
        <span className="sidebar__avatar" aria-hidden="true">
          {user.username.slice(0, 1).toUpperCase()}
        </span>
        <span className="sidebar__who">
          <span className="sidebar__role">{roleTitle}</span>
          <span className="sidebar__name">{user.username}</span>
        </span>
      </NavLink>

      <p className="sidebar__project" title={project?.title}>
        {project ? project.title : '선택한 프로젝트 없음'}
      </p>

      <nav className="sidebar__nav">
        <NavItem icon={IconHome} label="개요" to={project ? toProject() : null} end disabledReason={disabledReason} />
        <NavGroup icon={IconBell} label="알림" badge={unread} open={isOpen('noti')} onToggle={() => toggle('noti')} collapsed={collapsed} active={pathname === '/notifications'}>
          {(recent.data?.data ?? []).length === 0 && <p className="sidebar__empty">새 알림이 없어요</p>}
          {(recent.data?.data ?? []).map((n) => (
            <Link key={n.notification_id} to="/notifications" className={n.read_at ? 'sidebar__subitem sidebar__noti' : 'sidebar__subitem sidebar__noti is-unread'} title={n.body}>
              {n.body}
            </Link>
          ))}
          <NavLink to="/notifications" end className="sidebar__subitem">
            모든 알림 보기
          </NavLink>
          <NavLink to="/settings/notifications" className="sidebar__subitem">
            알림 설정
          </NavLink>
        </NavGroup>
        <NavItem icon={IconNotebook} label="원고 작성" to={project ? toProject('manuscripts') : null} disabledReason={disabledReason} />
        {[
          { key: 'review', icon: IconFileCheck, label: '검토', items: REVIEW_ITEMS },
          { key: 'design', icon: IconAffiliate, label: '설계', items: DESIGN_ITEMS },
        ].map((g) => (
          <NavGroup
            key={g.key}
            icon={g.icon}
            label={g.label}
            open={isOpen(g.key, g.items)}
            onToggle={() => toggle(g.key, g.items)}
            collapsed={collapsed}
            disabledReason={disabledReason}
            active={inGroup(g.items)}
          >
            {g.items.map((i) =>
              i.disabled ? (
                <span key={i.sub} className="sidebar__subitem" aria-disabled="true" title="아직 준비 중이에요">
                  {i.label}
                </span>
              ) : (
                <NavLink key={i.sub} to={toProject(i.sub)} className="sidebar__subitem">
                  {i.label}
                </NavLink>
              ),
            )}
          </NavGroup>
        ))}
        <NavGroup icon={IconUsersGroup} label="팀" open={open.teams ?? pathname.startsWith('/teams')} onToggle={() => setOpen((o) => ({ ...o, teams: !(o.teams ?? pathname.startsWith('/teams')) }))} collapsed={collapsed} active={pathname.startsWith('/teams')}>
          {(teams.data ?? []).map((t) => (
            <NavLink key={t.team_id} to={`/teams/${t.team_id}`} className="sidebar__subitem">
              {t.name}
            </NavLink>
          ))}
          <NavLink to="/teams/new" className="sidebar__subitem">
            + 새 팀 만들기
          </NavLink>
        </NavGroup>
      </nav>

      <div className="sidebar__bottom">
        <NavItem icon={IconSettings} label="프로젝트 멤버" to={project ? toProject('members') : null} disabledReason={disabledReason} />
        <button type="button" className="sidebar__item" onClick={onLogout} title={collapsed ? '로그아웃' : undefined}>
          <IconLogout size={24} stroke={1.5} aria-hidden="true" />
          <span className="sidebar__label">로그아웃</span>
        </button>
      </div>
    </aside>
  )
}

interface NavItemProps {
  icon: Icon
  label: string
  to: string | null
  end?: boolean
  disabledReason?: string
}

function NavItem({ icon: I, label, to, end, disabledReason }: NavItemProps) {
  const content = (
    <>
      <I size={24} stroke={1.5} aria-hidden="true" />
      <span className="sidebar__label">{label}</span>
    </>
  )
  if (!to || disabledReason) {
    return (
      <button type="button" className="sidebar__item" aria-disabled="true" title={disabledReason ?? label}>
        {content}
      </button>
    )
  }
  return (
    <NavLink to={to} end={end} className="sidebar__item" title={label}>
      {content}
    </NavLink>
  )
}

interface NavGroupProps {
  icon: Icon
  label: string
  open: boolean
  onToggle: () => void
  collapsed: boolean
  active?: boolean
  disabledReason?: string
  /** 안 읽은 알림 수처럼 이름 옆에 붙는 숫자. 0이면 숨긴다 */
  badge?: number
  children: ReactNode
}

function NavGroup({ icon: I, label, open, onToggle, collapsed, active, disabledReason, badge, children }: NavGroupProps) {
  const disabled = Boolean(disabledReason)
  const expanded = open && !collapsed && !disabled
  return (
    <div className="sidebar__group">
      <button
        type="button"
        className={active ? 'sidebar__item sidebar__item--in-group' : 'sidebar__item'}
        aria-expanded={disabled ? undefined : expanded}
        aria-disabled={disabled || undefined}
        title={disabledReason ?? label}
        onClick={disabled ? undefined : onToggle}
      >
        <I size={24} stroke={1.5} aria-hidden="true" />
        <span className="sidebar__label">
          {label}
          {badge ? <span className="sidebar__badge" aria-label={`안 읽음 ${badge}개`}>{badge}</span> : null}
        </span>
        <span className="sidebar__chevron" aria-hidden="true">
          <IconChevronDown size={14} />
        </span>
      </button>
      {expanded && <div className="sidebar__sub">{children}</div>}
    </div>
  )
}
