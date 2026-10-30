import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  loginSchema,
  signupChaptersSchema,
  signupSchema,
  type LoginFormValues,
  type SignupFormValues,
} from './auth-schema'
import { CaptchaField } from './captcha-field'
import { useAuth } from './use-auth'
import './auth.css'

function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <header className="auth-brand">
          <div className="brand-mark" aria-hidden="true">
            D
          </div>
          <div>
            <p className="brand-name">DeMolay Rondônia</p>
            <p className="brand-caption">Campanhas estaduais</p>
          </div>
        </header>
        <div className="auth-heading">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
        </div>
        {children}
        <footer className="auth-footer">
          <span>DeMolay-RO</span>
          <span>•</span>
          <span>Portal de campanhas</span>
          <span>•</span>
          <Link to="/privacy">Privacidade</Link>
          <span>•</span>
          <Link to="/terms">Termos</Link>
        </footer>
      </section>
    </main>
  )
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null
  return (
    <span className="field-error" role="alert">
      {children}
    </span>
  )
}

function FormAlert({ children }: { children: string | null }) {
  if (!children) return null
  return (
    <p className="form-alert" role="alert">
      {children}
    </p>
  )
}

function AuthLoading() {
  return (
    <main className="auth-page">
      <p className="auth-loading" role="status">
        Verificando sua conta…
      </p>
    </main>
  )
}

export function LoginPage() {
  const { client, session, profile, loading, error: profileError } = useAuth()
  const navigate = useNavigate()
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (loading) return <AuthLoading />
  if (profileError) {
    return (
      <AuthLayout
        eyebrow="Acesso seguro"
        title="Não foi possível verificar sua conta"
        description="Por segurança, o acesso permanece bloqueado enquanto o status da conta não puder ser confirmado."
      >
        <FormAlert>{profileError}</FormAlert>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      </AuthLayout>
    )
  }
  if (session) {
    return (
      <Navigate
        to={profile?.status === 'approved' ? '/' : '/awaiting-approval'}
        replace
      />
    )
  }

  const onSubmit = async (values: LoginFormValues) => {
    setMessage(null)
    if (!captchaToken) {
      setMessage('Conclua a verificação de segurança para continuar.')
      return
    }

    setSubmitting(true)
    try {
      const { error: signInError } = await client.auth.signInWithPassword({
        email: values.email,
        password: values.password,
        options: { captchaToken },
      })

      if (signInError) {
        setMessage('Não foi possível entrar. Verifique seus dados e tente novamente.')
        setCaptchaToken(null)
        setCaptchaKey((value) => value + 1)
      } else {
        navigate('/awaiting-approval', { replace: true })
      }
    } catch {
      setMessage('Não foi possível entrar. Tente novamente em instantes.')
      setCaptchaToken(null)
      setCaptchaKey((value) => value + 1)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Bem-vindo de volta"
      title="Entre na sua conta"
      description="Acesse o portal para acompanhar as campanhas do seu capítulo."
    >
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="form-field">
          <span>E-mail do capítulo</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="voce@capitulo.org"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            {...register('email')}
          />
          <span id="login-email-error">
            <FieldError>{errors.email?.message}</FieldError>
          </span>
        </label>

        <label className="form-field">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Sua senha"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? 'login-password-error' : undefined
            }
            {...register('password')}
          />
          <span id="login-password-error">
            <FieldError>{errors.password?.message}</FieldError>
          </span>
        </label>

        <CaptchaField key={captchaKey} onToken={setCaptchaToken} />
        <FormAlert>{message}</FormAlert>
        <button
          className="button button--primary"
          type="submit"
          disabled={submitting || !captchaToken}
        >
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="auth-switch">
        Ainda não tem acesso? <Link to="/signup">Criar conta</Link>
      </p>
    </AuthLayout>
  )
}

export function SignupPage() {
  const { client, session, profile, loading, error: profileError } = useAuth()
  const navigate = useNavigate()
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      chapterNumber: undefined,
      position: '',
      termsAccepted: false,
      guardianConsent: false,
    },
  })

  if (loading) return <AuthLoading />
  if (profileError) {
    return (
      <AuthLayout
        eyebrow="Acesso seguro"
        title="Não foi possível verificar sua conta"
        description="Por segurança, o acesso permanece bloqueado enquanto o status da conta não puder ser confirmado."
      >
        <FormAlert>{profileError}</FormAlert>
      </AuthLayout>
    )
  }
  if (session) {
    return (
      <Navigate
        to={profile?.status === 'approved' ? '/' : '/awaiting-approval'}
        replace
      />
    )
  }

  const onSubmit = async (values: SignupFormValues) => {
    setMessage(null)
    setSuccess(false)
    if (!captchaToken) {
      setMessage('Conclua a verificação de segurança para continuar.')
      return
    }

    setSubmitting(true)
    try {
      const { data: chaptersData, error: chaptersError } =
        await client.rpc('signup_chapters')
      const chapters = signupChaptersSchema.safeParse(chaptersData)

      if (chaptersError || !chapters.success) {
        setMessage('Não foi possível carregar os capítulos. Tente novamente.')
        return
      }

      const chapter = chapters.data.find(
        (item) => item.number === values.chapterNumber,
      )
      if (!chapter) {
        setMessage('Não encontramos esse capítulo. Confira o número informado.')
        return
      }

      const { data, error: signUpError } = await client.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          captchaToken,
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: values.fullName,
            chapter_id: chapter.id,
            position: values.position,
            terms_accepted: true,
            guardian_consent: values.guardianConsent,
          },
        },
      })

      if (signUpError) {
        setMessage(
          'Não foi possível criar a conta. Confira os dados e tente novamente.',
        )
        setCaptchaToken(null)
        setCaptchaKey((value) => value + 1)
        return
      }

      if (data.session) {
        navigate('/awaiting-approval', { replace: true })
        return
      }

      setSuccess(true)
    } catch {
      setMessage('Não foi possível criar a conta. Tente novamente em instantes.')
      setCaptchaToken(null)
      setCaptchaKey((value) => value + 1)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <AuthLayout
        eyebrow="Cadastro recebido"
        title="Confirme seu e-mail"
        description="Se os dados informados puderem ser cadastrados, enviaremos uma mensagem para confirmar o endereço. Depois, sua conta aguardará a aprovação da equipe."
      >
        <div className="status-panel" role="status">
          <span className="status-icon" aria-hidden="true">
            ✓
          </span>
          <p>
            Verifique sua caixa de entrada e a pasta de spam. Por segurança,
            não exibimos aqui se o e-mail já possui cadastro.
          </p>
        </div>
        <Link className="button button--primary button--link" to="/login">
          Ir para entrar
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Faça parte"
      title="Crie sua conta"
      description="Cadastre-se com seu e-mail do capítulo. Toda nova conta precisa ser aprovada."
    >
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="form-field">
          <span>Nome completo</span>
          <input
            autoComplete="name"
            placeholder="Seu nome"
            aria-invalid={Boolean(errors.fullName)}
            {...register('fullName')}
          />
          <FieldError>{errors.fullName?.message}</FieldError>
        </label>

        <label className="form-field">
          <span>E-mail do capítulo</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="voce@capitulo.org"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          <FieldError>{errors.email?.message}</FieldError>
        </label>

        <label className="form-field">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Pelo menos 10 caracteres"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          <FieldError>{errors.password?.message}</FieldError>
        </label>

        <div className="form-row">
          <label className="form-field">
            <span>Número do capítulo</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="Ex.: 123"
              aria-invalid={Boolean(errors.chapterNumber)}
              {...register('chapterNumber', { valueAsNumber: true })}
            />
            <FieldError>{errors.chapterNumber?.message}</FieldError>
          </label>

          <label className="form-field">
            <span>Cargo no capítulo</span>
            <input
              autoComplete="organization-title"
              placeholder="Ex.: Mestre Conselheiro"
              aria-invalid={Boolean(errors.position)}
              {...register('position')}
            />
            <FieldError>{errors.position?.message}</FieldError>
          </label>
        </div>

        <label className="checkbox-field">
          <input type="checkbox" {...register('termsAccepted')} />
          <span>
            Li e aceito os <Link to="/terms">termos de uso</Link> e a{' '}
            <Link to="/privacy">política de privacidade</Link>.
            <FieldError>{errors.termsAccepted?.message}</FieldError>
          </span>
        </label>

        <label className="checkbox-field checkbox-field--notice">
          <input type="checkbox" {...register('guardianConsent')} />
          <span>
            Se aplicável, confirmo que tenho autorização do responsável legal.
            A participação de menores deve observar seu melhor interesse.
          </span>
        </label>

        <CaptchaField key={captchaKey} onToken={setCaptchaToken} />
        <FormAlert>{message}</FormAlert>
        <button
          className="button button--primary"
          type="submit"
          disabled={submitting || !captchaToken}
        >
          {submitting ? 'Enviando…' : 'Criar conta'}
        </button>
      </form>

      <p className="auth-switch">
        Já tem uma conta? <Link to="/login">Entrar</Link>
      </p>
    </AuthLayout>
  )
}

export function AwaitingApprovalPage() {
  const { session, profile, loading, error, refreshProfile, signOut } = useAuth()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  if (loading) return <AuthLoading />
  if (!session) return <Navigate to="/login" replace />
  if (error || !profile) {
    return (
      <AuthLayout
        eyebrow="Acesso seguro"
        title="Não foi possível verificar sua conta"
        description="O acesso aos dados permanece bloqueado até que o status da conta possa ser confirmado."
      >
        <FormAlert>{error ?? 'Perfil indisponível.'}</FormAlert>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => void refreshProfile()}
        >
          Tentar novamente
        </button>
      </AuthLayout>
    )
  }
  if (profile.status === 'approved') return <Navigate to="/" replace />

  const handleSignOut = async () => {
    setSigningOut(true)
    setSignOutError(null)
    try {
      await signOut()
    } catch {
      setSignOutError('Não foi possível encerrar sua sessão. Tente novamente.')
    } finally {
      setSigningOut(false)
    }
  }

  const rejected = profile.status === 'rejected'

  return (
    <AuthLayout
      eyebrow={rejected ? 'Cadastro não aprovado' : 'Cadastro em análise'}
      title={rejected ? 'Acesso não liberado' : 'Estamos analisando seu cadastro'}
      description={
        rejected
          ? 'Sua conta não foi aprovada para acessar as campanhas. Se precisar de ajuda, entre em contato com a equipe responsável.'
          : 'Seu cadastro foi recebido. Enquanto aguarda a aprovação, o acesso aos dados e às campanhas permanece bloqueado.'
      }
    >
      <div className="status-panel" role="status">
        <span
          className={`status-icon${rejected ? ' status-icon--muted' : ''}`}
          aria-hidden="true"
        >
          {rejected ? '!' : '…'}
        </span>
        <p>
          {rejected
            ? 'Você pode sair da conta nesta tela.'
            : 'A equipe responsável atualizará o status do cadastro após a análise.'}
        </p>
      </div>
      <FormAlert>{signOutError}</FormAlert>
      <button
        className="button button--secondary"
        type="button"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
      >
        {signingOut ? 'Saindo…' : 'Sair da conta'}
      </button>
    </AuthLayout>
  )
}
