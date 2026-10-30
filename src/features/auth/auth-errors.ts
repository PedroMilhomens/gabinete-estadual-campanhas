type AuthAction = 'login' | 'signup'

export function getAuthFailureMessage(
  errorMessage: string,
  action: AuthAction,
): string {
  if (/captcha|turnstile|challenge/i.test(errorMessage)) {
    return 'A verificação de segurança não foi aceita. Confira se a site key do Turnstile e a secret key do Supabase pertencem ao mesmo widget e ambiente.'
  }

  return action === 'login'
    ? 'Não foi possível entrar. Verifique seus dados e tente novamente.'
    : 'Não foi possível criar a conta. Confira os dados e tente novamente.'
}
