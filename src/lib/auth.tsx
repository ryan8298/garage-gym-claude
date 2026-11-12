import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearLocalData, db } from './db'
import { supabase } from './supabase'

/**
 * Sign-in state that survives being offline.
 * Who is signed in is remembered on the phone. A failed token refresh (no
 * signal, expired token) never signs you out: you keep logging and the sync
 * engine asks you to sign in again only when it needs to upload.
 */

export interface LocalUser {
  id: string
  email: string
}

const KEY = 'gg.user'
const read = (): LocalUser | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}

interface AuthValue {
  user: LocalUser | null
  signIn(email: string, password: string): Promise<string | null>
  signOut(): Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(read)

  const remember = useCallback((u: LocalUser) => {
    localStorage.setItem(KEY, JSON.stringify(u))
    setUser((prev) => (prev?.id === u.id ? prev : u))
  }, [])

  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Only ever add or refresh the remembered user here. SIGNED_OUT events
      // caused by a failed refresh are ignored on purpose.
      if (session?.user) remember({ id: session.user.id, email: session.user.email ?? '' })
    })
    return () => data.subscription.unsubscribe()
  }, [remember])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      async signIn(email, password) {
        if (!supabase) return 'The app is not connected to a database yet.'
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) return error.message === 'Failed to fetch' ? 'No connection. Try again when you have signal.' : error.message
        const previous = read()
        if (previous && previous.id !== data.user.id) await clearLocalData(db)
        remember({ id: data.user.id, email: data.user.email ?? '' })
        return null
      },
      async signOut() {
        await supabase?.auth.signOut().catch(() => undefined)
        await clearLocalData(db)
        localStorage.removeItem(KEY)
        setUser(null)
      },
    }),
    [user, remember],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
