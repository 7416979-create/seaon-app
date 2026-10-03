import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import * as authService from './authService'
import type { Session } from './authService'

interface AuthState {
  session: Session | null
  login: (id: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => authService.loadSession())

  const login = useCallback(async (id: string, password: string) => {
    setSession(await authService.login(id, password))
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setSession(null)
  }, [])

  const value = useMemo(() => ({ session, login, logout }), [session, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
