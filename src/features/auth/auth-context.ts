import { createContext } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { UserProfile } from './auth-schema'

export type AuthContextValue = {
  client: SupabaseClient
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
