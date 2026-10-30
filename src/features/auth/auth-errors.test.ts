import { describe, expect, it } from 'vitest'
import { getAuthFailureMessage } from './auth-errors'

describe('getAuthFailureMessage', () => {
  it('explains CAPTCHA validation failures without exposing provider details', () => {
    expect(
      getAuthFailureMessage('captcha verification process failed', 'login'),
    ).toContain('site key do Turnstile')
    expect(
      getAuthFailureMessage('captcha verification process failed', 'signup'),
    ).not.toContain('captcha verification process failed')
  })

  it('keeps other authentication failures generic', () => {
    expect(
      getAuthFailureMessage('Invalid login credentials', 'login'),
    ).toBe('Não foi possível entrar. Verifique seus dados e tente novamente.')
    expect(
      getAuthFailureMessage('email already registered', 'signup'),
    ).toBe('Não foi possível criar a conta. Confira os dados e tente novamente.')
  })
})
