import { Outlet, useLocation } from 'react-router-dom'
import { LandingPage } from './LandingPage'

/**
 * 랜딩과 로그인·회원가입을 한 화면에 둔다. /auth/* 에서는 랜딩 위로 패널이 모달처럼 옆에서 나온다.
 * 랜딩을 계속 띄워 두므로 패널을 닫으면 보던 자리 그대로 돌아간다.
 */
export function LandingLayout() {
  const overlay = useLocation().pathname.startsWith('/auth')
  return (
    <>
      <LandingPage behind={overlay} />
      <Outlet />
    </>
  )
}
