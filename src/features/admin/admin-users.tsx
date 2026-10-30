import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../auth/use-auth'

const adminUserSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  position: z.string().nullable(),
  role: z.enum(['member', 'reviewer', 'admin']),
  status: z.enum(['pending', 'approved', 'rejected']),
  created_at: z.string(),
  chapter: z
    .object({
      name: z.string(),
      number: z.number().int().nullable(),
    })
    .nullable(),
})

type AdminUser = z.infer<typeof adminUserSchema>
type StatusFilter = 'pending' | 'all'

const statusLabels: Record<AdminUser['status'], string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
}

function formatCreatedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Data indisponível'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date)
}

export function AdminUsersPage() {
  const { client, profile, loading: authLoading, error: authError } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [dataAction, setDataAction] = useState<{
    userId: string
    action: 'export' | 'delete'
  } | null>(null)

  const loadUsers = useCallback(async () => {
    if (
      authLoading ||
      authError ||
      profile?.status !== 'approved' ||
      profile.role !== 'admin'
    ) {
      return
    }

    try {
      const { data, error } = await client
        .from('profiles')
        .select(
          'id, full_name, position, role, status, created_at, chapter:chapters(name, number)',
        )
        .order('created_at', { ascending: false })

      if (error) {
        setLoadError('Não foi possível carregar os cadastros. Tente novamente.')
        return
      }

      const parsedUsers = z.array(adminUserSchema).safeParse(data)
      if (!parsedUsers.success) {
        setLoadError('A lista de cadastros retornou dados inválidos.')
        return
      }

      setUsers(parsedUsers.data)
      setLoadError(null)
    } catch {
      setLoadError('Não foi possível carregar os cadastros. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [authError, authLoading, client, profile])

  useEffect(() => {
    if (
      !authLoading &&
      !authError &&
      profile?.status === 'approved' &&
      profile.role === 'admin'
    ) {
      const request = window.setTimeout(() => {
        void loadUsers()
      }, 0)
      return () => window.clearTimeout(request)
    }
    return undefined
  }, [authError, authLoading, loadUsers, profile?.role, profile?.status])

  const refreshUsers = () => {
    setLoading(true)
    void loadUsers()
  }

  const filteredUsers = useMemo(
    () =>
      statusFilter === 'pending'
        ? users.filter((user) => user.status === 'pending')
        : users,
    [statusFilter, users],
  )

  const updateStatus = async (
    user: AdminUser,
    status: 'approved' | 'rejected',
  ) => {
    setUpdatingUserId(user.id)
    setActionError(null)

    try {
      const { data, error } = await client
        .from('profiles')
        .update({ status })
        .eq('id', user.id)
        .select('id, status')
        .maybeSingle()

      if (error) {
        setActionError(
          'Não foi possível atualizar o cadastro. Sua sessão pode não ter permissão para esta ação.',
        )
        return
      }

      if (!data) {
        setActionError(
          'O cadastro não foi atualizado. Atualize a lista e tente novamente.',
        )
        return
      }

      const updatedProfile = z
        .object({ id: z.string().uuid(), status: z.enum(['approved', 'rejected']) })
        .safeParse(data)

      if (!updatedProfile.success) {
        setActionError('A resposta da atualização não pôde ser validada.')
        return
      }

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === updatedProfile.data.id
            ? { ...currentUser, status: updatedProfile.data.status }
            : currentUser,
        ),
      )
    } catch {
      setActionError('Não foi possível atualizar o cadastro. Tente novamente.')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const manageUserData = async (
    user: AdminUser,
    action: 'export' | 'delete',
  ) => {
    if (
      action === 'delete' &&
      !window.confirm(
        `Excluir permanentemente a conta de ${user.full_name}, seus envios e arquivos? Essa ação não pode ser desfeita.`,
      )
    ) {
      return
    }

    setDataAction({ userId: user.id, action })
    setActionError(null)

    try {
      const { data, error } = await client.functions.invoke('lgpd-user-data', {
        body: { action, userId: user.id },
      })

      if (error) {
        setActionError(
          action === 'export'
            ? 'Não foi possível exportar os dados deste usuário.'
            : 'Não foi possível excluir os dados deste usuário.',
        )
        return
      }

      if (action === 'export') {
        const file = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        })
        const downloadUrl = URL.createObjectURL(file)
        const anchor = document.createElement('a')
        anchor.href = downloadUrl
        anchor.download = `exportacao-dados-${user.id}.json`
        document.body.append(anchor)
        anchor.click()
        anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
      } else {
        setUsers((currentUsers) =>
          currentUsers.filter((currentUser) => currentUser.id !== user.id),
        )
      }
    } catch {
      setActionError(
        action === 'export'
          ? 'Não foi possível exportar os dados deste usuário.'
          : 'Não foi possível excluir os dados deste usuário.',
      )
    } finally {
      setDataAction(null)
    }
  }

  if (authLoading) {
    return (
      <main className="admin-page">
        <p role="status">Verificando sua conta…</p>
      </main>
    )
  }

  if (authError) {
    return (
      <main className="admin-page">
        <section className="admin-panel" role="alert">
          <h1>Não foi possível verificar sua conta</h1>
          <p>{authError}</p>
        </section>
      </main>
    )
  }

  if (!profile || profile.status !== 'approved' || profile.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <main className="admin-page">
      <section className="admin-content" aria-labelledby="admin-title">
        <header className="admin-header">
          <Link className="admin-brand-link" to="/">
            <div className="auth-brand">
              <div className="brand-mark" aria-hidden="true">
                D
              </div>
              <div>
                <p className="brand-name">DeMolay Rondônia</p>
                <p className="brand-caption">Administração</p>
              </div>
            </div>
          </Link>
          <div className="admin-header-actions">
            <button
              className="admin-refresh"
              type="button"
              onClick={refreshUsers}
              disabled={loading}
            >
              Atualizar lista
            </button>
          </div>
        </header>

        <div className="admin-title-row">
          <div>
            <p className="auth-eyebrow">Gestão de acesso</p>
            <h1 id="admin-title">Cadastros de usuários</h1>
            <p className="admin-description">
              Revise as solicitações de acesso ao portal. Aprovações e rejeições
              são registradas no log de auditoria.
            </p>
          </div>
          <div className="admin-count" aria-live="polite">
            <strong>
              {users.filter((user) => user.status === 'pending').length}
            </strong>
            <span>pendentes</span>
          </div>
        </div>

        <div className="admin-toolbar">
          <div className="admin-tabs" aria-label="Filtrar cadastros">
            <button
              className={statusFilter === 'pending' ? 'is-active' : ''}
              type="button"
              aria-pressed={statusFilter === 'pending'}
              onClick={() => setStatusFilter('pending')}
            >
              Pendentes
            </button>
            <button
              className={statusFilter === 'all' ? 'is-active' : ''}
              type="button"
              aria-pressed={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            >
              Todos
            </button>
          </div>
          <p className="admin-result-count">
            {filteredUsers.length}{' '}
            {filteredUsers.length === 1 ? 'cadastro' : 'cadastros'}
          </p>
        </div>

        {actionError && (
          <p className="admin-alert" role="alert">
            {actionError}
          </p>
        )}

        {loadError ? (
          <div className="admin-empty" role="alert">
            <p>{loadError}</p>
            <button
              className="admin-refresh"
              type="button"
              onClick={refreshUsers}
            >
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <p className="admin-empty" role="status">
            Carregando cadastros…
          </p>
        ) : filteredUsers.length === 0 ? (
          <div className="admin-empty">
            <span className="admin-empty-icon" aria-hidden="true">
              ✓
            </span>
            <h2>
              {statusFilter === 'pending'
                ? 'Nenhuma solicitação pendente'
                : 'Nenhum cadastro encontrado'}
            </h2>
            <p>
              {statusFilter === 'pending'
                ? 'Novas solicitações aparecerão aqui para revisão.'
                : 'Ainda não há contas cadastradas.'}
            </p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Pessoa</th>
                  <th scope="col">Capítulo</th>
                  <th scope="col">Solicitado em</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.full_name}</strong>
                      <span className="admin-cell-caption">
                        {user.position || 'Cargo não informado'}
                      </span>
                    </td>
                    <td>
                      {user.chapter
                        ? `${user.chapter.number ? `Nº ${user.chapter.number} — ` : ''}${user.chapter.name}`
                        : 'Capítulo não informado'}
                    </td>
                    <td>{formatCreatedAt(user.created_at)}</td>
                    <td>
                      <span className={`admin-status admin-status--${user.status}`}>
                        {statusLabels[user.status]}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        {user.status !== 'approved' && (
                          <button
                            className="admin-action admin-action--approve"
                            type="button"
                            onClick={() => void updateStatus(user, 'approved')}
                            disabled={updatingUserId !== null || dataAction !== null}
                          >
                            {updatingUserId === user.id
                              ? 'Salvando…'
                              : 'Aprovar'}
                          </button>
                        )}
                        {user.status !== 'rejected' && (
                          <button
                            className="admin-action admin-action--reject"
                            type="button"
                            onClick={() => void updateStatus(user, 'rejected')}
                            disabled={updatingUserId !== null || dataAction !== null}
                          >
                            Rejeitar
                          </button>
                        )}
                        <button
                          className="admin-action admin-action--data"
                          type="button"
                          onClick={() => void manageUserData(user, 'export')}
                          disabled={updatingUserId !== null || dataAction !== null}
                        >
                          {dataAction?.userId === user.id &&
                          dataAction.action === 'export'
                            ? 'Exportando…'
                            : 'Exportar dados'}
                        </button>
                        <button
                          className="admin-action admin-action--reject"
                          type="button"
                          onClick={() => void manageUserData(user, 'delete')}
                          disabled={updatingUserId !== null || dataAction !== null}
                        >
                          {dataAction?.userId === user.id &&
                          dataAction.action === 'delete'
                            ? 'Excluindo…'
                            : 'Excluir dados'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
