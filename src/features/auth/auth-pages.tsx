import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signupChaptersSchema,
  signupSchema,
  type ForgotPasswordFormValues,
  type LoginFormValues,
  type ResetPasswordFormValues,
  type SignupFormValues,
} from './auth-schema'
import { getAuthFailureMessage } from './auth-errors'
import { CaptchaField } from './captcha-field'
import { useAuth } from './use-auth'
import emblem from '../../assets/brand/emblema-virtudes-atemporais.png'
import { SITE_NAME } from '../../config/site'
import {
  clearPasswordRecovery,
  hasPasswordRecoveryMarker,
  markPasswordRecovery,
} from './password-recovery-state'
import './auth.css'
import './access-pages.css'

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
    <main className="access-page">
      <div className="access-layout">
        <aside className="access-brand-panel">
          <Link className="access-brand" to="/login">
            <img
              src={emblem}
              width={220}
              height={316}
              alt="Emblema Virtudes Atemporais"
            />
          </Link>
          <div className="access-brand-copy">
            <p className="access-brand-overline">Virtudes atemporais</p>
            <p className="access-brand-name">{SITE_NAME}</p>
            <h2>Tempo, serviço e virtude em cada realização.</h2>
            <p>
              Um espaço para fortalecer o trabalho dos capítulos e celebrar
              cada conquista.
            </p>
          </div>
          <div className="access-brand-footer">
            <span aria-hidden="true" />
            <p>Campanhas estaduais · Rondônia</p>
          </div>
        </aside>
        <section className="access-form-panel" aria-labelledby="auth-title">
          <header className="access-mobile-brand">
            <img
              src={emblem}
              width={52}
              height={72}
              alt="Emblema Virtudes Atemporais"
            />
            <span>{SITE_NAME}</span>
          </header>
          <div className="access-form-content">
            <div className="access-heading">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
            </div>
            {children}
            <footer className="access-footer">
              <span>Portal de campanhas</span>
              <nav aria-label="Informações institucionais">
                <Link to="/privacy">Privacidade</Link>
                <Link to="/terms">Termos</Link>
              </nav>
            </footer>
          </div>
        </section>
      </div>
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
  const location = useLocation()
  const navigate = useNavigate()
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [message, setMessage] = useState<string | null>(() => {
    const state = location.state
    return typeof state === 'object' &&
      state !== null &&
      'message' in state &&
      typeof state.message === 'string'
      ? state.message
      : null
  })
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
        setMessage(getAuthFailureMessage(signInError.message, 'login'))
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
      <p className="auth-switch">
        <Link to="/forgot-password">Esqueci minha senha</Link>
      </p>
    </AuthLayout>
  )
}

const passwordResetRequestMessage =
  'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.'

export function ForgotPasswordPage() {
  const { client } = useAuth()
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    )
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setMessage(null)
    setSent(false)
    if (!captchaToken) {
      setMessage('Conclua a verificação de segurança para continuar.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await client.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken,
      })

      if (error) {
        setMessage(
          'Não foi possível solicitar a redefinição agora. Confira a verificação de segurança e tente novamente.',
        )
        return
      }

      setMessage(passwordResetRequestMessage)
      setSent(true)
      setCooldown(60)
    } catch {
      setMessage(
        'Não foi possível solicitar a redefinição agora. Confira a verificação de segurança e tente novamente.',
      )
    } finally {
      setCaptchaToken(null)
      setCaptchaKey((value) => value + 1)
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Recuperação de acesso"
      title="Redefina sua senha"
      description="Informe seu e-mail e enviaremos as instruções para criar uma nova senha."
    >
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="form-field">
          <span>E-mail da conta</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="voce@capitulo.org"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          <FieldError>{errors.email?.message}</FieldError>
        </label>
        <CaptchaField key={captchaKey} onToken={setCaptchaToken} />
        <FormAlert>{message}</FormAlert>
        <button
          className="button button--primary"
          type="submit"
          disabled={submitting || cooldown > 0 || !captchaToken}
        >
          {submitting
            ? 'Enviando…'
            : cooldown > 0
              ? `Aguarde ${cooldown}s para tentar novamente`
              : 'Enviar instruções'}
        </button>
      </form>
      {sent && (
        <p className="form-note" role="status">
          Verifique também sua caixa de spam.
        </p>
      )}
      <p className="auth-switch">
        <Link to="/login">Voltar para entrar</Link>
      </p>
    </AuthLayout>
  )
}

export function ResetPasswordPage() {
  const { client } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [recoverySession, setRecoverySession] = useState(false)
  const [verificationError, setVerificationError] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [passwordUpdated, setPasswordUpdated] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', passwordConfirmation: '' },
  })

  useEffect(() => {
    let active = true
    let recoveryEventReceived = false
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        recoveryEventReceived = true
        markPasswordRecovery()
        setRecoverySession(true)
        setVerificationError(false)
        setChecking(false)
      } else if (event === 'SIGNED_OUT') {
        clearPasswordRecovery()
        setRecoverySession(false)
      }
    })

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || recoveryEventReceived) return
        if (error) {
          setVerificationError(true)
          setChecking(false)
          return
        }
        setRecoverySession(
          Boolean(data.session && hasPasswordRecoveryMarker()),
        )
        setChecking(false)
      })
      .catch(() => {
        if (!active || recoveryEventReceived) return
        setVerificationError(true)
        setChecking(false)
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [client])

  const signOutAndReturnToLogin = async () => {
    setMessage(null)
    try {
      const { error } = await client.auth.signOut()
      if (error) {
        setMessage(
          'A senha foi atualizada, mas não foi possível encerrar sua sessão. Tente novamente.',
        )
        return
      }
      clearPasswordRecovery()
      navigate('/login', {
        replace: true,
        state: { message: 'Sua senha foi redefinida com sucesso. Entre novamente.' },
      })
    } catch {
      setMessage(
        'A senha foi atualizada, mas não foi possível encerrar sua sessão. Tente novamente.',
      )
    }
  }

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setMessage(null)
    if (!recoverySession) return
    setSubmitting(true)
    try {
      const { error } = await client.auth.updateUser({
        password: values.password,
      })
      if (error) {
        setMessage(
          'Não foi possível atualizar sua senha. Solicite um novo link e tente novamente.',
        )
        return
      }
      setPasswordUpdated(true)
      await signOutAndReturnToLogin()
    } catch {
      setMessage(
        'Não foi possível atualizar sua senha. Solicite um novo link e tente novamente.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) return <AuthLoading />
  if (verificationError) {
    return (
      <AuthLayout
        eyebrow="Acesso seguro"
        title="Não foi possível verificar o link"
        description="Atualize a página para tentar verificar o link novamente."
      >
        <Link className="button button--secondary button--link" to="/forgot-password">
          Solicitar outro link
        </Link>
      </AuthLayout>
    )
  }
  if (!recoverySession) {
    return (
      <AuthLayout
        eyebrow="Recuperação de acesso"
        title="Link inválido ou expirado"
        description="Solicite um novo link para redefinir sua senha."
      >
        <Link className="button button--primary button--link" to="/forgot-password">
          Solicitar novo link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Recuperação de acesso"
      title="Crie uma nova senha"
      description="Escolha uma senha com pelo menos 10 caracteres."
    >
      {passwordUpdated ? (
        <>
          <FormAlert>{message}</FormAlert>
          {message && (
            <button
              className="button button--primary"
              type="button"
              onClick={() => void signOutAndReturnToLogin()}
            >
              Encerrar sessão e continuar
            </button>
          )}
        </>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className="form-field">
            <span>Nova senha</span>
            <input
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <FieldError>{errors.password?.message}</FieldError>
          </label>
          <label className="form-field">
            <span>Confirme a nova senha</span>
            <input
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.passwordConfirmation)}
              {...register('passwordConfirmation')}
            />
            <FieldError>{errors.passwordConfirmation?.message}</FieldError>
          </label>
          <FormAlert>{message}</FormAlert>
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Atualizando…' : 'Atualizar senha'}
          </button>
        </form>
      )}
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

      if (chaptersError) {
        console.error('Could not load signup chapters from Supabase.', {
          code: chaptersError.code,
          message: chaptersError.message,
          details: chaptersError.details,
          hint: chaptersError.hint,
        })
        setMessage('Não foi possível carregar os capítulos. Tente novamente.')
        return
      }

      const chapters = signupChaptersSchema.safeParse(chaptersData)
      if (!chapters.success) {
        console.error(
          'Supabase returned an invalid signup chapters response.',
          chapters.error.issues,
        )
        setMessage(
          'A lista de capítulos está com uma resposta inválida. Avise a equipe responsável pelo sistema.',
        )
        return
      }

      if (chapters.data.length === 0) {
        setMessage(
          'Nenhum capítulo está cadastrado para seleção. Avise a equipe responsável pelo sistema.',
        )
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
        setMessage(getAuthFailureMessage(signUpError.message, 'signup'))
        setCaptchaToken(null)
        setCaptchaKey((value) => value + 1)
        return
      }

      if (data.session) {
        navigate('/awaiting-approval', { replace: true })
        return
      }

      setSuccess(true)
    } catch (error) {
      console.error('Unexpected error while creating an account.', error)
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
