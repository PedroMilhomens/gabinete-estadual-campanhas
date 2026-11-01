import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BarChart3,
  Bug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileUp,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import emblem from '../assets/brand/emblema-virtudes-atemporais.png'
import { BUG_REPORT_URL, SITE_NAME } from '../config/site'
import { useAuth } from '../features/auth/use-auth'
import { ThemeToggle } from '../theme/theme-provider'
import './app-shell.css'

type NavigationItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
}

function getNavigationItems(role: string | undefined): NavigationItem[] {
  const items: NavigationItem[] = [
    { to: '/', label: 'Início', icon: LayoutDashboard },
    { to: '/campaigns', label: 'Campanhas', icon: ClipboardList },
  ]

  if (role === 'member') {
    items.push({
      to: '/my-submissions',
      label: 'Meus envios',
      icon: FileUp,
    })
  }
  if (role === 'reviewer' || role === 'admin') {
    items.push({
      to: '/review',
      label: 'Avaliações',
      icon: ShieldCheck,
    })
    items.push({
      to: '/export',
      label: 'Exportar dados',
      icon: FileUp,
    })
  }
  if (role === 'member' || role === 'reviewer' || role === 'admin') {
    items.push({ to: '/ranking', label: 'Ranking', icon: BarChart3 })
  }
  if (role === 'admin') {
    items.push({
      to: '/admin/users',
      label: 'Usuários',
      icon: Users,
    })
  }

  return items
}

function Navigation({
  items,
  collapsed,
  onNavigate,
}: {
  items: NavigationItem[]
  collapsed: boolean
  onNavigate?: () => void
}) {
  return (
    <nav className="app-shell-nav" aria-label="Navegação principal">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `app-shell-nav-link${isActive ? ' app-shell-nav-link--active' : ''}`
          }
          onClick={onNavigate}
          title={collapsed ? label : undefined}
        >
          <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function UserMenu({
  fullName,
  role,
  onSignOut,
}: {
  fullName: string
  role: string
  onSignOut: () => void
}) {
  return (
    <details className="app-shell-user-menu">
      <summary aria-label={`Menu do usuário: ${fullName}`}>
        <span className="app-shell-avatar" aria-hidden="true">
          {fullName.trim().charAt(0).toLocaleUpperCase('pt-BR')}
        </span>
        <span className="app-shell-user-copy">
          <strong>{fullName}</strong>
          <small>{role}</small>
        </span>
        <ChevronDown
          className="app-shell-user-chevron"
          aria-hidden="true"
          size={16}
        />
      </summary>
      <div className="app-shell-user-popover">
        <p>{fullName}</p>
        <button type="button" onClick={onSignOut}>
          Sair da conta
        </button>
      </div>
    </details>
  )
}

export function AuthenticatedShell({ children }: { children?: ReactNode }) {
  const { session, profile, loading, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const mobileDialog = useRef<HTMLDialogElement>(null)
  const navigationItems = getNavigationItems(profile?.role)
  const approved = profile?.status === 'approved'

  useEffect(() => {
    const dialog = mobileDialog.current
    if (!dialog) return
    if (mobileOpen && !dialog.open) dialog.showModal()
    if (!mobileOpen && dialog.open) dialog.close()
  }, [mobileOpen])

  const handleSignOut = async () => {
    setSignOutError(null)
    try {
      await signOut()
    } catch {
      setSignOutError('Não foi possível encerrar sua sessão. Tente novamente.')
    }
  }

  if (loading || !session) return children ?? <Outlet />

  return (
    <div
      className={`app-shell${collapsed ? ' app-shell--collapsed' : ''}${approved ? '' : ' app-shell--limited'}`}
    >
      <header className="app-shell-header">
        <button
          className="app-shell-mobile-trigger"
          type="button"
          aria-label="Abrir menu de navegação"
          aria-haspopup="dialog"
          onClick={() => setMobileOpen(true)}
        >
          <Menu aria-hidden="true" size={22} />
        </button>
        <Link className="app-shell-brand" to="/">
          <img
            src={emblem}
            width={40}
            height={40}
            alt="Emblema Virtudes Atemporais"
          />
          <span>{SITE_NAME}</span>
        </Link>
        <div className="app-shell-header-actions">
          <a
            className="app-shell-report-bug"
            href={BUG_REPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Relatar um bug"
          >
            <Bug aria-hidden="true" size={18} />
            <span>Relatar bug</span>
          </a>
          <ThemeToggle placement="header" />
          {profile && (
            <UserMenu
              fullName={profile.full_name}
              role={
                approved
                  ? profile.role === 'admin'
                    ? 'Administrador'
                    : profile.role === 'reviewer'
                      ? 'Avaliador'
                      : 'Membro'
                  : profile.status === 'rejected'
                    ? 'Cadastro não aprovado'
                    : 'Cadastro em análise'
              }
              onSignOut={() => void handleSignOut()}
            />
          )}
        </div>
      </header>

      <div className="app-shell-body">
        {approved && (
          <aside className="app-shell-sidebar" aria-label="Menu lateral">
            <button
              className="app-shell-collapse"
              type="button"
              aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? (
                <ChevronRight aria-hidden="true" size={18} />
              ) : (
                <>
                  <span>Recolher menu</span>
                  <ChevronLeft aria-hidden="true" size={18} />
                </>
              )}
            </button>
            <Navigation items={navigationItems} collapsed={collapsed} />
          </aside>
        )}
        <div className="app-shell-content">
          {signOutError && (
            <p className="app-shell-error" role="alert">
              {signOutError}
            </p>
          )}
          {children ?? <Outlet />}
        </div>
      </div>

      <dialog
        className="app-shell-mobile-dialog"
        ref={mobileDialog}
        aria-label="Menu de navegação"
        onCancel={() => setMobileOpen(false)}
        onClose={() => setMobileOpen(false)}
        onClick={(event) => {
          if (event.target === mobileDialog.current) setMobileOpen(false)
        }}
      >
        <div className="app-shell-mobile-header">
          <Link className="app-shell-brand" to="/" onClick={() => setMobileOpen(false)}>
            <img
              src={emblem}
              width={40}
              height={40}
              alt="Emblema Virtudes Atemporais"
            />
            <span>{SITE_NAME}</span>
          </Link>
          <button
            type="button"
            className="app-shell-icon-button"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        {approved && (
          <Navigation
            items={navigationItems}
            collapsed={false}
            onNavigate={() => setMobileOpen(false)}
          />
        )}
        {profile && (
          <UserMenu
            fullName={profile.full_name}
            role={approved ? profile.role : 'Acesso pendente'}
            onSignOut={() => void handleSignOut()}
          />
        )}
      </dialog>
    </div>
  )
}
