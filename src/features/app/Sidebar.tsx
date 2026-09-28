import { useState, type ComponentType, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
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
import { useSession } from '../../auth/session'
import { ROLE_OPTIONS } from '../../lib/roles'

type Icon = ComponentType<IconProps>

interface SidebarProps {
  /** 열려 있는 프로젝트. 없으면 프로젝트 전용 메뉴를 비활성으로 둔다 */
  project: { id: string; title: string } | null
  collapsed: boolean
  onToggle: () => void
}

const REVIEW_ITEMS = ['세계관 설정', '설정 충돌']
const DESIGN_ITEMS = ['캐릭터 분석', '관계 변화 그래프', '복선 추적', '스토리 맵']

// Figma 915:2343 Sidebar (Default / Close)
export function Sidebar({ project, collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate()
  const { user, signOut } = useSession()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  if (!user) return null

  const roleTitle = ROLE_OPTIONS.find((r) => r.value === user.role)?.title ?? ''
  const disabledReason = project ? undefined : '프로젝트를 열면 쓸 수 있어요'
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }))

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

      <NavLink to="/projects" className="sidebar__profile" title="내 프로젝트">
        <span className="sidebar__avatar" aria-hidden="true">
          {user.username.slice(0, 1).toUpperCase()}
        </span>
        <span className="sidebar__who">
          <span className="sidebar__role">{roleTitle}</span>
          <span className="sidebar__name">{user.username}</span>
        </span>
      </NavLink>

      <p className="sidebar__project">{project ? project.title : '선택한 프로젝트 없음'}</p>

      <nav className="sidebar__nav">
        <NavItem icon={IconHome} label="개요" disabledReason={disabledReason} />
        <NavGroup icon={IconBell} label="알림" open={Boolean(open.noti)} onToggle={() => toggle('noti')} collapsed={collapsed}>
          <p className="sidebar__empty">새 알림이 없어요</p>
        </NavGroup>
        <NavItem icon={IconNotebook} label="원고 작성" disabledReason={disabledReason} />

        <div className="sidebar__divider" />

        <NavGroup
          icon={IconFileCheck}
          label="검토"
          boxed
          open={Boolean(open.review)}
          onToggle={() => toggle('review')}
          collapsed={collapsed}
          disabledReason={disabledReason}
        >
          {REVIEW_ITEMS.map((label) => (
            <SubItem key={label} label={label} />
          ))}
        </NavGroup>
        <NavGroup
          icon={IconAffiliate}
          label="설계"
          boxed
          open={Boolean(open.design)}
          onToggle={() => toggle('design')}
          collapsed={collapsed}
          disabledReason={disabledReason}
        >
          {DESIGN_ITEMS.map((label) => (
            <SubItem key={label} label={label} />
          ))}
        </NavGroup>
      </nav>

      <div className="sidebar__bottom">
        <NavItem icon={IconSettings} label="설정" disabledReason="준비 중이에요" />
        <button type="button" className="sidebar__item" onClick={onLogout} title={collapsed ? '로그아웃' : undefined}>
          <IconLogout size={24} stroke={1.5} aria-hidden="true" />
          <span className="sidebar__label">로그아웃</span>
        </button>
      </div>
    </aside>
  )
}

function NavItem({ icon: I, label, disabledReason }: { icon: Icon; label: string; disabledReason?: string }) {
  // 프로젝트 화면이 아직 없어 모두 비활성. 화면이 생기면 NavLink로 바꾼다.
  return (
    <button type="button" className="sidebar__item" aria-disabled={Boolean(disabledReason) || undefined} title={disabledReason ?? label}>
      <I size={24} stroke={1.5} aria-hidden="true" />
      <span className="sidebar__label">{label}</span>
    </button>
  )
}

interface NavGroupProps {
  icon: Icon
  label: string
  open: boolean
  onToggle: () => void
  collapsed: boolean
  boxed?: boolean
  disabledReason?: string
  children: ReactNode
}

function NavGroup({ icon: I, label, open, onToggle, collapsed, boxed, disabledReason, children }: NavGroupProps) {
  const disabled = Boolean(disabledReason)
  const expanded = open && !collapsed && !disabled
  return (
    <div className="sidebar__group">
      <button
        type="button"
        className="sidebar__item"
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

function SubItem({ label }: { label: string }) {
  return (
    <button type="button" className="sidebar__subitem" aria-disabled="true" title="준비 중이에요">
      {label}
    </button>
  )
}
