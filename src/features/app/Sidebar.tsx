import { useState, type ComponentType, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
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
  type IconProps,
} from '@tabler/icons-react'
import type { Project } from '../../api/types'
import { useSession } from '../../auth/session'
import { ROLE_OPTIONS } from '../../lib/roles'
import { projectPath } from './currentProject'

type Icon = ComponentType<IconProps>

interface SidebarProps {
  /** 열려 있는 프로젝트. 없으면 프로젝트 전용 메뉴를 비활성으로 둔다 */
  project: Project | null
  collapsed: boolean
  onToggle: () => void
}

const REVIEW_ITEMS = [
  { label: '세계관 설정', sub: 'rules' },
  { label: '설정 충돌', sub: 'conflicts' },
]
const DESIGN_ITEMS = [
  { label: '캐릭터 분석', sub: 'characters' },
  { label: '관계 변화 그래프', sub: 'relationships' },
  { label: '복선 추적', sub: 'foreshadowings' },
  { label: '스토리 맵', sub: 'story-map' },
]

// Figma 915:2343 Sidebar (Default / Close)
export function Sidebar({ project, collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, signOut } = useSession()
  const [open, setOpen] = useState<Record<string, boolean>>({})
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
        <NavGroup icon={IconBell} label="알림" open={isOpen('noti')} onToggle={() => toggle('noti')} collapsed={collapsed}>
          <p className="sidebar__empty">새 알림이 없어요</p>
        </NavGroup>
        <NavItem icon={IconNotebook} label="원고 작성" to={project ? toProject('manuscripts') : null} disabledReason={disabledReason} />

        <div className="sidebar__divider" />

        {[
          { key: 'review', icon: IconFileCheck, label: '검토', items: REVIEW_ITEMS },
          { key: 'design', icon: IconAffiliate, label: '설계', items: DESIGN_ITEMS },
        ].map((g) => (
          <NavGroup
            key={g.key}
            icon={g.icon}
            label={g.label}
            boxed
            open={isOpen(g.key, g.items)}
            onToggle={() => toggle(g.key, g.items)}
            collapsed={collapsed}
            disabledReason={disabledReason}
            active={inGroup(g.items)}
          >
            {g.items.map((i) => (
              <NavLink key={i.sub} to={toProject(i.sub)} className="sidebar__subitem">
                {i.label}
              </NavLink>
            ))}
          </NavGroup>
        ))}
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
  boxed?: boolean
  active?: boolean
  disabledReason?: string
  children: ReactNode
}

function NavGroup({ icon: I, label, open, onToggle, collapsed, boxed, active, disabledReason, children }: NavGroupProps) {
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
        <span className="sidebar__label">{label}</span>
        <span className={boxed ? 'sidebar__chevron sidebar__chevron--boxed' : 'sidebar__chevron'} aria-hidden="true">
          <IconChevronDown size={14} />
        </span>
      </button>
      {expanded && <div className="sidebar__sub">{children}</div>}
    </div>
  )
}
