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
import { CharactersPage } from './features/characters/CharactersPage'
import { DraftPage } from './features/characters/DraftPage'
import { NewCharacterPage } from './features/characters/NewCharacterPage'
import { AskPage } from './features/manuscripts/AskPage'
import { EditorPage } from './features/manuscripts/EditorPage'
import { HistoryPage } from './features/manuscripts/HistoryPage'
import { ManuscriptsPage } from './features/manuscripts/ManuscriptsPage'
import { NewProjectPage } from './features/projects/NewProjectPage'
import { OverviewPage } from './features/projects/OverviewPage'
import { ForeshadowingsPage } from './features/foreshadowings/ForeshadowingsPage'
import { ProjectsPage } from './features/projects/ProjectsPage'
import { RelationshipsPage } from './features/relationships/RelationshipsPage'
import { StoryMapPage } from './features/story/StoryMapPage'
import { ConflictsPage } from './features/world/ConflictsPage'
import { RulesPage } from './features/world/RulesPage'

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
              <Route path="manuscripts/:manuscriptId/history" element={<HistoryPage />} />
              <Route path="ask" element={<AskPage />} />
              <Route path="characters" element={<CharactersPage />} />
              <Route path="characters/new" element={<NewCharacterPage />} />
              <Route path="characters/drafts/:draftId" element={<DraftPage />} />
              <Route path="rules" element={<RulesPage />} />
              <Route path="conflicts" element={<ConflictsPage />} />
              <Route path="relationships" element={<RelationshipsPage />} />
              <Route path="foreshadowings" element={<ForeshadowingsPage />} />
              <Route path="story-map" element={<StoryMapPage />} />
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
