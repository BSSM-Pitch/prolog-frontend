import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import './AppShell.css'

const COLLAPSE_KEY = 'prolog.sidebar.collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/** 로그인 이후 화면의 공통 틀: 왼쪽 사이드바 + 작업 영역 */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        // 저장하지 못해도 이번 화면에서는 접힌 상태 유지
      }
      return !c
    })
  }

  return (
    <div className={collapsed ? 'app app--collapsed' : 'app'}>
      <Sidebar project={null} collapsed={collapsed} onToggle={toggle} />
      <main className="app__main">
        <Outlet />
      </main>
    </div>
  )
}
