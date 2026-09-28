import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider, useSession } from './auth/session'
import { AuthShell } from './features/auth/AuthShell'
import { FindIdPage } from './features/auth/FindIdPage'
import { LoginPage } from './features/auth/LoginPage'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { RolePage } from './features/auth/RolePage'
import { SignupPage } from './features/auth/SignupPage'
import { VerifyPage } from './features/auth/VerifyPage'
import { AppShell } from './features/app/AppShell'
import { ComingSoon } from './features/app/ComingSoon'
import { ProjectsPage } from './features/projects/ProjectsPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useSession()
  if (status === 'loading') return null
  return status === 'signed-in' ? children : <Navigate to="/auth/login" replace />
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useSession()
  if (status === 'loading') return null
  return status === 'signed-out' ? children : <Navigate to="/projects" replace />
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route
            path="/auth"
            element={
              <GuestOnly>
                <AuthShell />
              </GuestOnly>
            }
          >
            {/* 시작 화면(Figma 1173:2377)은 패널 셸만 보인다 */}
            <Route index element={null} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="signup/role" element={<RolePage />} />
            <Route path="signup/verify" element={<VerifyPage />} />
            <Route path="find-id" element={<FindIdPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
          </Route>
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<ComingSoon title="새 프로젝트" figma="Figma 1247:1989 새 프로젝트" />} />
            <Route path="/projects/:projectId" element={<ComingSoon title="작품 개요" figma="Figma 841:784 · 01 개요" />} />
          </Route>
          {/* 이전 임시 홈 주소 */}
          <Route path="/home" element={<Navigate to="/projects" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
