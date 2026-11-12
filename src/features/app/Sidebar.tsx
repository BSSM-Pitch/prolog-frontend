import { useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { IconChevronDown, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import * as notificationsApi from '../../api/notifications'
import * as teamsApi from '../../api/teams'
import type { Project } from '../../api/types'
import { MotionIcon, useHoverPlay, type IconName } from '../../components/MotionIcon'
import { useSession } from '../../auth/session'
import { useResource } from '../../lib/useResource'
import { Logo } from '../landing/components/Logo'
import { useNotificationsChanged } from '../notifications/labels'
import { useTeamsChanged } from '../teams/teamEvents'
import { projectPath } from './currentProject'

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
  const bellHover = useHoverPlay()
  const teamHover = useHoverPlay()
  const logoutHover = useHoverPlay()
  const { asideRef, bar } = useActiveBar(
    `${pathname}|${collapsed}|${teamsOpen}|${project?.project_id ?? ''}|${Boolean(user)}|${teams.data?.length ?? 0}`,
  )
  if (!user) return null
  const to = (sub = '') => projectPath(project!.project_id, sub)
  const showTeams = teamsOpen ?? pathname.startsWith('/teams')

  async function onLogout() {
    await signOut()
    navigate('/auth/login', { replace: true })
  }

  return (
    <aside ref={asideRef} id="app-navigation" className={collapsed ? 'sidebar sidebar--collapsed' : 'sidebar'} aria-label="주 메뉴">
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
      <span
        className={bar ? 'sidebar__bar is-ready' : 'sidebar__bar'}
        style={bar ? { transform: `translate(${bar.x}px, ${bar.y}px)`, height: bar.h } : undefined}
        aria-hidden="true"
      />
      <nav className="sidebar__nav" aria-label="서재 메뉴">
        <NavItem icon="book" label="내 서재" to="/projects" end />
        {project && (
          <>
            <p className="sidebar__project" title={project.title}>
              {project.title}
            </p>
            <NavItem icon="home" label="작품 홈" to={to()} end />
            <NavItem icon="notebook" label="원고" to={to('manuscripts')} />
            <NavItem
              icon="route"
              label="작품 살펴보기"
              to={to('story-map')}
              active={['story-map', 'relationships', 'foreshadowings', 'conflicts'].some(
                (path) => pathname === to(path),
              )}
            />
            <NavItem icon="user" label="등장인물" to={to('characters')} />
            <NavItem icon="world" label="세계관" to={to('rules')} />
            <NavItem icon="usersGroup" label="팀원 초대" to={to('members')} />
          </>
        )}
      </nav>
      <nav className="sidebar__secondary" aria-label="계정 메뉴">
        <NavLink
          to="/notifications"
          className="sidebar__item"
          aria-label={unread ? `알림 ${unread}개 안 읽음` : '알림'}
          title="알림"
          {...bellHover.hoverProps}
        >
          <MotionIcon name="bell" playing={bellHover.playing} />
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
          {...teamHover.hoverProps}
          onClick={() => {
            if (collapsed) onToggle()
            setTeamsOpen(collapsed ? true : !showTeams)
          }}
        >
          <MotionIcon name="usersGroup" playing={teamHover.playing} />
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
        <button
          type="button"
          className="sidebar__logout"
          onClick={onLogout}
          aria-label="로그아웃"
          title="로그아웃"
          {...logoutHover.hoverProps}
        >
          <MotionIcon name="logout" playing={logoutHover.playing} />
        </button>
      </div>
    </aside>
  )
}

/** 선택된 메뉴 옆 막대는 하나만 두고, 선택이 바뀌면 새 자리로 미끄러지게 한다 */
function useActiveBar(key: string) {
  const asideRef = useRef<HTMLElement>(null)
  const [bar, setBar] = useState<{ x: number; y: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const aside = asideRef.current
    if (!aside) return
    const measure = () => {
      const item = aside.querySelector<HTMLElement>('.sidebar__item.active')
      const a = aside.getBoundingClientRect()
      const r = item?.getBoundingClientRect()
      if (!r || !a.width || !r.height) return setBar(null)
      const next = { x: Math.round(r.left - a.left), y: Math.round(r.top - a.top + 12), h: Math.round(r.height - 24) }
      setBar((b) => (b && b.x === next.x && b.y === next.y && b.h === next.h ? b : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(aside)
    const nav = aside.querySelector('.sidebar__nav')
    nav?.addEventListener('scroll', measure)
    return () => {
      ro.disconnect()
      nav?.removeEventListener('scroll', measure)
    }
  }, [key])
  return { asideRef, bar }
}

function NavItem({
  icon,
  label,
  to,
  end,
  active,
}: {
  icon: IconName
  label: string
  to: string
  end?: boolean
  active?: boolean
}) {
  const { playing, hoverProps } = useHoverPlay()
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `sidebar__item${isActive || active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={label}
      {...hoverProps}
    >
      <MotionIcon name={icon} playing={playing} />
      <span className="sidebar__label">{label}</span>
    </NavLink>
  )
}
