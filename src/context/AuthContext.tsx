import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { clearOfflineHttpCache } from '../lib/offlineFetch'

// Offline, Supabase can't refresh an expired access token, so getSession()
// reports no session even though this device is still signed in (the
// session is only removed from storage on a real sign-out or a rejected
// refresh token). Fall back to that stored session so the app stays usable
// offline; reads are then served from the offline cache, and the token is
// refreshed automatically once the connection is back.
function storedSession(): Session | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as Partial<Session> & { currentSession?: Session }
      const session = (parsed.currentSession ?? parsed) as Session
      if (session?.access_token && session.user) return session
    }
  } catch {
    // ignore
  }
  return null
}

interface AuthContextValue {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? storedSession())
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        setSession(newSession)
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        void clearOfflineHttpCache()
      } else {
        setSession((prev) => prev ?? storedSession())
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signOut() {
    // Offline the server can't be told; still sign out on this device.
    const { error } = await supabase.auth.signOut(navigator.onLine ? undefined : { scope: 'local' })
    if (error) throw error
    setSession(null)
    await clearOfflineHttpCache()
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
