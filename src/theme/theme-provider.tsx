import { createContext, useContext, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useLocation } from 'react-router-dom'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
}

const THEME_STORAGE_KEY = 'demolay-ro-theme'
const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitialTheme(): Theme {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
  } catch (error) {
    console.error('Não foi possível ler a preferência de tema salva.', error)
  }

  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch (error) {
      console.error('Não foi possível salvar a preferência de tema.', error)
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

const standaloneRoutes = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
])

export function ThemeToggle({
  placement = 'floating',
}: {
  placement?: 'floating' | 'header'
}) {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('ThemeToggle precisa ser usado dentro de ThemeProvider.')
  }
  const { pathname } = useLocation()
  const isStandaloneRoute = standaloneRoutes.has(pathname)
  if (
    (placement === 'floating' && !isStandaloneRoute) ||
    (placement === 'header' && isStandaloneRoute)
  ) {
    return null
  }

  const { theme, toggleTheme } = context
  const nextThemeLabel = theme === 'dark' ? 'claro' : 'escuro'
  const Icon = theme === 'dark' ? Sun : Moon
  const isLegalRoute = pathname === '/privacy' || pathname === '/terms'

  return (
    <button
      className={`theme-toggle theme-toggle--${placement}${isLegalRoute ? ' theme-toggle--legal' : ''}`}
      type="button"
      aria-label={`Ativar modo ${nextThemeLabel}`}
      title={`Ativar modo ${nextThemeLabel}`}
      onClick={toggleTheme}
    >
      <Icon aria-hidden="true" size={18} />
      <span>Modo {nextThemeLabel}</span>
    </button>
  )
}
