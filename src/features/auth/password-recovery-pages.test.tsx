// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { createClient } from '@supabase/supabase-js'
import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from './auth-context'
import type { AuthContextValue } from './auth-context'
import {
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
} from './auth-pages'
import {
  clearPasswordRecovery,
  markPasswordRecovery,
} from './password-recovery-state'

vi.mock('./captcha-field', () => ({
  CaptchaField: ({
    onToken,
  }: {
    onToken: (token: string | null) => void
  }) => (
    <button type="button" onClick={() => onToken('test-captcha-token')}>
      Validar CAPTCHA
    </button>
  ),
}))

const recoveryMessage =
  'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.'

const session: Session = {
  access_token: 'test-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4_000_000_000,
  refresh_token: 'test-refresh-token',
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
  },
}

let client: SupabaseClient
let authValue: AuthContextValue
let authListener:
  | ((event: AuthChangeEvent, nextSession: Session | null) => void)
  | undefined

function renderPage(page: ReactNode, initialEntry = '/') {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={page} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  client = createClient('https://example.supabase.co', 'test-anon-key', {
    auth: { persistSession: false },
  })
  authListener = undefined
  authValue = {
    client,
    session: null,
    profile: null,
    loading: false,
    error: null,
    refreshProfile: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  }

  vi.spyOn(client.auth, 'onAuthStateChange').mockImplementation((callback) => {
    authListener = callback
    return {
      data: {
        subscription: {
          id: 'test-subscription',
          callback,
          unsubscribe: vi.fn(),
        },
      },
    }
  })
  vi.spyOn(client.auth, 'getSession').mockResolvedValue({
    data: { session: null },
    error: null,
  })
  vi.spyOn(client.auth, 'resetPasswordForEmail').mockResolvedValue({
    data: {},
    error: null,
  })
  vi.spyOn(client.auth, 'updateUser').mockResolvedValue({
    data: { user: session.user },
    error: null,
  })
  vi.spyOn(client.auth, 'signOut').mockResolvedValue({
    error: null,
  })
  clearPasswordRecovery()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  clearPasswordRecovery()
})

describe('ForgotPasswordPage', () => {
  it('is linked from the login page', () => {
    renderPage(<LoginPage />)
    expect(
      screen.getByRole('link', { name: 'Esqueci minha senha' }).getAttribute('href'),
    ).toBe('/forgot-password')
  })

  it.each(['known@example.test', 'unknown@example.test'])(
    'shows the same generic response for %s',
    async (email) => {
      renderPage(<ForgotPasswordPage />)
      fireEvent.change(screen.getByLabelText('E-mail da conta'), {
        target: { value: email },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Validar CAPTCHA' }))
      fireEvent.click(screen.getByRole('button', { name: 'Enviar instruções' }))

      expect(await screen.findByText(recoveryMessage)).toBeTruthy()
      expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(email, {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken: 'test-captcha-token',
      })
      expect(
        screen.getByRole('button', { name: 'Aguarde 60s para tentar novamente' })
          .hasAttribute('disabled'),
      ).toBe(true)
    },
  )
})

describe('ResetPasswordPage', () => {
  it('rejects a missing recovery session without calling updateUser', async () => {
    renderPage(<ResetPasswordPage />)

    expect(
      await screen.findByRole('heading', { name: 'Link inválido ou expirado' }),
    ).toBeTruthy()
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('requires a recovery session before allowing pending and rejected users to open it', async () => {
    for (const status of ['pending', 'rejected'] as const) {
      vi.mocked(client.auth.getSession).mockResolvedValue({
        data: { session },
        error: null,
      })
      authValue = {
        ...authValue,
        session,
        profile: {
          id: session.user.id,
          full_name: 'Member Example',
          chapter_id: null,
          role: 'member',
          status,
        },
      }
      const forgotPage = renderPage(<ForgotPasswordPage />)
      expect(
        screen.getByRole('heading', { name: 'Redefina sua senha' }),
      ).toBeTruthy()
      forgotPage.unmount()

      markPasswordRecovery()
      const { unmount } = renderPage(<ResetPasswordPage />)
      expect(
        await screen.findByRole('heading', { name: 'Crie uma nova senha' }),
      ).toBeTruthy()
      unmount()
      clearPasswordRecovery()
    }
  })

  it.each([
    ['short', 'short', 'A senha deve ter pelo menos 10 caracteres.'],
    [
      'a-valid-password',
      'a-different-password',
      'As senhas não coincidem.',
    ],
  ])('rejects invalid password values', async (password, confirmation, error) => {
    vi.mocked(client.auth.getSession).mockResolvedValue({
      data: { session },
      error: null,
    })
    markPasswordRecovery()
    renderPage(<ResetPasswordPage />)

    await screen.findByRole('heading', { name: 'Crie uma nova senha' })
    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: password },
    })
    fireEvent.change(screen.getByLabelText('Confirme a nova senha'), {
      target: { value: confirmation },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar senha' }))

    expect(await screen.findByText(error)).toBeTruthy()
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('accepts the PASSWORD_RECOVERY event and signs out after updating the password', async () => {
    renderPage(
      <ResetPasswordPage />,
    )

    await waitFor(() => expect(authListener).toBeDefined())
    authListener?.('PASSWORD_RECOVERY', session)
    expect(
      await screen.findByRole('heading', { name: 'Crie uma nova senha' }),
    ).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'a-valid-password' },
    })
    fireEvent.change(screen.getByLabelText('Confirme a nova senha'), {
      target: { value: 'a-valid-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar senha' }))

    await waitFor(() => expect(client.auth.updateUser).toHaveBeenCalledWith({
      password: 'a-valid-password',
    }))
    await waitFor(() => expect(client.auth.signOut).toHaveBeenCalled())
    expect(
      await screen.findByText(
        'Sua senha foi redefinida com sucesso. Entre novamente.',
      ),
    ).toBeTruthy()
  })
})
