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
import { EditorPage } from './features/manuscripts/EditorPage'
import { ManuscriptsPage } from './features/manuscripts/ManuscriptsPage'
import { ComingSoon } from './features/app/ComingSoon'
import { NewProjectPage } from './features/projects/NewProjectPage'
import { OverviewPage } from './features/projects/OverviewPage'
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
            <Route path="/projects/new" element={<NewProjectPage />} />
            <Route path="/projects/:projectId">
              <Route index element={<OverviewPage />} />
              <Route path="manuscripts" element={<ManuscriptsPage />} />
              <Route path="manuscripts/:manuscriptId" element={<EditorPage />} />
              <Route path="manuscripts/:manuscriptId/history" element={<ComingSoon title="편집 이력" figma="Figma 1261:3042 · 32 원고 편집 이력" />} />
              <Route path="ask" element={<ComingSoon title="AI 질문" figma="Figma 842:579 · 02 AI 질문" />} />
              <Route path="characters" element={<ComingSoon title="등장인물" figma="Figma 842:863 · 20 등장인물" />} />
              <Route path="rules" element={<ComingSoon title="설정 규칙" figma="Figma 843:1659 · 21 설정 규칙" />} />
              <Route path="conflicts" element={<ComingSoon title="설정 충돌 검토" figma="Figma 843:1781 · 05 설정 충돌 검토" />} />
              <Route path="relationships" element={<ComingSoon title="관계 변화" figma="Figma 843:1109 · 13 관계 변화" />} />
              <Route path="foreshadowings" element={<ComingSoon title="복선 추적" figma="Figma 843:1394 · 04 복선 추적" />} />
              <Route path="story-map" element={<ComingSoon title="스토리 지도" figma="Figma 843:1243 · 03 스토리 지도" />} />
              <Route path="*" element={<Navigate to="." replace />} />
            </Route>
          </Route>
          {/* 이전 임시 홈 주소 */}
          <Route path="/home" element={<Navigate to="/projects" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
