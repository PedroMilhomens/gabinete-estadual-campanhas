// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider, ThemeToggle } from './theme-provider'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
})

describe('ThemeProvider', () => {
  it('toggles dark mode and persists the selected theme', () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/login']}>
          <ThemeToggle />
        </MemoryRouter>
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ativar modo escuro' }))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(window.localStorage.getItem('demolay-ro-theme')).toBe('dark')
    expect(
      screen.getByRole('button', { name: 'Ativar modo claro' }),
    ).toBeTruthy()
  })

  it('restores a previously selected light theme', () => {
    window.localStorage.setItem('demolay-ro-theme', 'light')
    document.documentElement.classList.add('dark')

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/login']}>
          <ThemeToggle />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(
      screen.getByRole('button', { name: 'Ativar modo escuro' }),
    ).toBeTruthy()
  })
})
