// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../features/auth/auth-context'
import type { AuthContextValue } from '../features/auth/auth-context'
import { AuthenticatedShell } from './app-shell'

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

function renderShell() {
  const client = createClient('https://example.supabase.co', 'test-anon-key', {
    auth: { persistSession: false },
  })
  const value: AuthContextValue = {
    client,
    session,
    profile: {
      id: session.user.id,
      full_name: 'Member Example',
      chapter_id: null,
      role: 'member',
      status: 'approved',
    },
    loading: false,
    error: null,
    refreshProfile: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  }

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter>
        <AuthenticatedShell>
          <main>Conteúdo da página</main>
        </AuthenticatedShell>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AuthenticatedShell', () => {
  it('renders the site header and role-aware navigation with a collapsible sidebar', () => {
    renderShell()

    expect(
      screen.getAllByText('Gabinete Estadual de Rondônia'),
    ).toHaveLength(2)
    expect(screen.getByRole('link', { name: /Campanhas/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Meus envios/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Avaliações/ })).toBeNull()

    const collapseButton = screen.getByRole('button', {
      name: 'Recolher menu lateral',
    })
    fireEvent.click(collapseButton)
    expect(
      screen.getByRole('button', { name: 'Expandir menu lateral' }),
    ).toBeTruthy()
  })

  it('opens the mobile navigation dialog and closes it after navigation', async () => {
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    })
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: showModal,
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: close,
    })

    renderShell()
    fireEvent.click(
      screen.getByRole('button', { name: 'Abrir menu de navegação' }),
    )

    const dialog = screen.getByRole('dialog', { name: 'Menu de navegação' })
    expect(showModal).toHaveBeenCalledOnce()
    fireEvent.click(
      screen.getAllByRole('link', { name: /Campanhas/ })[1],
    )
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(dialog.hasAttribute('open')).toBe(false)
  })
})
