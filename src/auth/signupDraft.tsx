import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { OAuthProvider, UserRole } from '../api/types'

// 회원가입 → 사용자 유형 → 계정 인증 사이에 입력값을 넘긴다.
// 비밀번호가 들어 있으므로 저장소에 남기지 않고 메모리에만 둔다(새로고침하면 처음부터 다시).
export interface SignupDraft {
  username: string
  email: string
  password: string
  role: UserRole
  /** 소셜로 가입하면 이메일 인증 단계를 건너뛴다 */
  provider: OAuthProvider | null
  /** AUTH v0.2 — 소셜 인증 후 받은 가입 티켓(10분). 있으면 아이디·유형만 정하고 가입을 마친다 */
  signupTicket: string | null
}

const empty: SignupDraft = { username: '', email: '', password: '', role: 'writer', provider: null, signupTicket: null }

interface DraftValue {
  draft: SignupDraft
  update: (patch: Partial<SignupDraft>) => void
  clear: () => void
}

const DraftContext = createContext<DraftValue | null>(null)

export function SignupDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SignupDraft>(empty)
  const value = useMemo<DraftValue>(
    () => ({
      draft,
      update: (patch) => setDraft((d) => ({ ...d, ...patch })),
      clear: () => setDraft(empty),
    }),
    [draft],
  )
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

export function useSignupDraft() {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useSignupDraft는 SignupDraftProvider 안에서만 쓸 수 있어요.')
  return ctx
}
