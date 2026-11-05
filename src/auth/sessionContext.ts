import { createContext } from 'react'
import type { AuthResult, User } from '../api/types'

export type SessionStatus = 'loading' | 'signed-in' | 'signed-out'
export interface SessionValue {
  status: SessionStatus
  user: User | null
  signIn: (result: AuthResult) => void
  signOut: () => Promise<void>
  withAuth: <T>(call: (accessToken: string) => Promise<T>) => Promise<T>
}

// Keep context identity stable when the provider/hooks are refreshed during local editing.
export const SessionContext = createContext<SessionValue | null>(null)
