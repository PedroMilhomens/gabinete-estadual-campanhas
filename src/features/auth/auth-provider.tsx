import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { AuthContext } from './auth-context'
import { profileSchema } from './auth-schema'
import {
  clearPasswordRecovery,
  markPasswordRecovery,
} from './password-recovery-state'

type AuthProviderProps = {
  client: SupabaseClient
  children: ReactNode
}

export function AuthProvider({ client, children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ReturnType<
    typeof profileSchema.parse
  > | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshProfile = useCallback(async () => {
    if (!session) {
      setProfile(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { data, error: profileError } = await client.rpc('current_profile')
      if (profileError) {
        setProfile(null)
        setError(
          'Não foi possível verificar o status da sua conta. Tente novamente.',
        )
        return
      }

      const parsedProfile = profileSchema.safeParse(data)
      if (!parsedProfile.success) {
        setProfile(null)
        setError('Não foi possível localizar um perfil válido para esta conta.')
        return
      }

      setProfile(parsedProfile.data)
    } catch {
      setProfile(null)
      setError('Não foi possível verificar o status da sua conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [client, session])

  useEffect(() => {
    let active = true
    let authEventReceived = false

    const loadSessionProfile = async (nextSession: Session | null) => {
      if (!active) return

      setSession(nextSession)
      setProfile(null)
      setError(null)

      if (!nextSession) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const { data, error: profileError } =
          await client.rpc('current_profile')

        if (!active) return

        if (profileError) {
          setError(
            'Não foi possível verificar o status da sua conta. Tente novamente.',
          )
        } else {
          const parsedProfile = profileSchema.safeParse(data)
          if (parsedProfile.success) {
            setProfile(parsedProfile.data)
          } else {
            setError(
              'Não foi possível localizar um perfil válido para esta conta.',
            )
          }
        }
      } catch {
        if (active) {
          setError(
            'Não foi possível verificar o status da sua conta. Tente novamente.',
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY' && nextSession) {
        markPasswordRecovery()
      } else if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        clearPasswordRecovery()
      }

      authEventReceived = true
      queueMicrotask(() => {
        void loadSessionProfile(nextSession)
      })
    })

    void client.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active || authEventReceived) return
        if (sessionError) {
          setError('Não foi possível recuperar sua sessão. Entre novamente.')
          setLoading(false)
          return
        }
        void loadSessionProfile(data.session)
      })
      .catch(() => {
        if (!active || authEventReceived) return
        setError('Não foi possível recuperar sua sessão. Entre novamente.')
        setLoading(false)
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [client])

  const signOut = useCallback(async () => {
    const { error: signOutError } = await client.auth.signOut()
    if (signOutError) {
      throw new Error('Não foi possível encerrar sua sessão. Tente novamente.')
    }
  }, [client])

  const value = useMemo(
    () => ({
      client,
      session,
      profile,
      loading,
      error,
      refreshProfile,
      signOut,
    }),
    [client, session, profile, loading, error, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
