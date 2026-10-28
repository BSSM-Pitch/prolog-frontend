import { useState, type ComponentType } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  IconBell,
  IconBook2,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconHome,
  IconLogout,
  IconNotebook,
  IconRoute,
  IconUser,
  IconUsersGroup,
  IconWorld,
  type IconProps,
} from '@tabler/icons-react'
import * as notificationsApi from '../../api/notifications'
import * as teamsApi from '../../api/teams'
import type { Project } from '../../api/types'
import { useSession } from '../../auth/session'
import { useResource } from '../../lib/useResource'
import { Logo } from '../landing/components/Logo'
import { useNotificationsChanged } from '../notifications/labels'
import { useTeamsChanged } from '../teams/teamEvents'
import { projectPath } from './currentProject'

type Icon = ComponentType<IconProps>
interface SidebarProps {
  project: Project | null
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ project, collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, signOut } = useSession()
  const [teamsOpen, setTeamsOpen] = useState<boolean | null>(null)
  const teams = useResource(user ? teamsApi.listTeams : null, [user?.user_id])
  useTeamsChanged(teams.reload)
  const recent = useResource(user ? (t) => notificationsApi.listNotifications(t, { limit: 1 }) : null, [
    user?.user_id,
    pathname,
  ])
  useNotificationsChanged(recent.reload)
  const unread = recent.data?.meta.unread_count ?? 0
  if (!user) return null
  const to = (sub = '') => projectPath(project!.project_id, sub)
  const showTeams = teamsOpen ?? pathname.startsWith('/teams')

  async function onLogout() {
    await signOut()
    navigate('/auth/login', { replace: true })
  }

  return (
    <aside id="app-navigation" className={collapsed ? 'sidebar sidebar--collapsed' : 'sidebar'} aria-label="주 메뉴">
      <Link to="/" className="sidebar__brand" aria-label="Prolog 홈">
        <Logo size={25} />
        <span>prolog</span>
      </Link>
      <button
        type="button"
        className="sidebar__collapse"
        onClick={onToggle}
        aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
      </button>
      <nav className="sidebar__nav" aria-label="서재 메뉴">
        <NavItem icon={IconBook2} label="내 서재" to="/projects" end />
        {project && (
          <>
            <p className="sidebar__project" title={project.title}>
              {project.title}
            </p>
            <NavItem icon={IconHome} label="작품 홈" to={to()} end />
            <NavItem icon={IconNotebook} label="원고" to={to('manuscripts')} />
            <NavItem
              icon={IconRoute}
              label="작품 살펴보기"
              to={to('story-map')}
              active={['story-map', 'relationships', 'foreshadowings', 'conflicts'].some(
                (path) => pathname === to(path),
              )}
            />
            <NavItem icon={IconUser} label="등장인물" to={to('characters')} />
            <NavItem icon={IconWorld} label="세계관" to={to('rules')} />
            <NavItem icon={IconUsersGroup} label="함께 쓰는 사람들" to={to('members')} />
          </>
        )}
      </nav>
      <nav className="sidebar__secondary" aria-label="계정 메뉴">
        <NavLink
          to="/notifications"
          className="sidebar__item"
          aria-label={unread ? `알림 ${unread}개 안 읽음` : '알림'}
          title="알림"
        >
          <IconBell size={19} stroke={1.7} aria-hidden="true" />
          <span className="sidebar__label">알림</span>
          {unread > 0 && (
            <span className="sidebar__badge" aria-hidden="true">
              {unread}
            </span>
          )}
        </NavLink>
        <button
          type="button"
          className="sidebar__item"
          title="팀"
          aria-label="팀"
          aria-expanded={showTeams && !collapsed}
          onClick={() => {
            if (collapsed) onToggle()
            setTeamsOpen(collapsed ? true : !showTeams)
          }}
        >
          <IconUsersGroup size={19} stroke={1.7} aria-hidden="true" />
          <span className="sidebar__label">팀</span>
          <IconChevronDown className="sidebar__chevron" size={14} aria-hidden="true" />
        </button>
        {showTeams && !collapsed && (
          <div className="sidebar__teams">
            {(teams.data ?? []).map((t) => (
              <NavLink key={t.team_id} to={`/teams/${t.team_id}`} className="sidebar__subitem">
                {t.name}
              </NavLink>
            ))}
            <NavLink to="/teams/new" className="sidebar__subitem">
              새 팀 만들기
            </NavLink>
          </div>
        )}
      </nav>
      <div className="sidebar__account">
        <span className="sidebar__name">{user.username}</span>
        <button type="button" className="sidebar__logout" onClick={onLogout} aria-label="로그아웃" title="로그아웃">
          <IconLogout size={19} stroke={1.7} aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}

function NavItem({
  icon: I,
  label,
  to,
  end,
  active,
}: {
  icon: Icon
  label: string
  to: string
  end?: boolean
  active?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `sidebar__item${isActive || active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={label}
    >
      <I size={19} stroke={1.7} aria-hidden="true" />
      <span className="sidebar__label">{label}</span>
    </NavLink>
  )
}
