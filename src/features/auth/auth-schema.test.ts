import { describe, expect, it } from 'vitest'
import {
  forgotPasswordSchema,
  loginSchema,
  profileSchema,
  resetPasswordSchema,
  signupSchema,
} from './auth-schema'

describe('loginSchema', () => {
  it('accepts a valid email and password', () => {
    expect(
      loginSchema.safeParse({
        email: 'member@example.test',
        password: 'valid-password',
      }).success,
    ).toBe(true)
  })

  it('rejects invalid email addresses and empty passwords', () => {
    expect(
      loginSchema.safeParse({ email: 'not-an-email', password: '' }).success,
    ).toBe(false)
  })
})

describe('signupSchema', () => {
  const validSignup = {
    fullName: 'Member Example',
    email: 'member@example.test',
    password: 'long-enough-password',
    chapterNumber: 123,
    position: 'Chapter officer',
    termsAccepted: true,
    guardianConsent: false,
  }

  it('accepts valid signup data', () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true)
  })

  it('requires explicit acceptance of the terms', () => {
    expect(
      signupSchema.safeParse({ ...validSignup, termsAccepted: false }).success,
    ).toBe(false)
  })

  it('requires a password of at least ten characters', () => {
    expect(
      signupSchema.safeParse({ ...validSignup, password: 'short' }).success,
    ).toBe(false)
  })

  it('requires a positive whole chapter number', () => {
    expect(
      signupSchema.safeParse({ ...validSignup, chapterNumber: 0 }).success,
    ).toBe(false)
    expect(
      signupSchema.safeParse({ ...validSignup, chapterNumber: 12.5 }).success,
    ).toBe(false)
  })
})

describe('password recovery schemas', () => {
  it('accepts a valid email address for recovery', () => {
    expect(
      forgotPasswordSchema.safeParse({ email: 'member@example.test' }).success,
    ).toBe(true)
    expect(forgotPasswordSchema.safeParse({ email: 'invalid' }).success).toBe(
      false,
    )
  })

  it('requires a ten-character password and matching confirmation', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'short',
        passwordConfirmation: 'short',
      }).success,
    ).toBe(false)
    expect(
      resetPasswordSchema.safeParse({
        password: 'a-valid-password',
        passwordConfirmation: 'a-different-password',
      }).success,
    ).toBe(false)
    expect(
      resetPasswordSchema.safeParse({
        password: 'a-valid-password',
        passwordConfirmation: 'a-valid-password',
      }).success,
    ).toBe(true)
  })
})

describe('profileSchema', () => {
  it('rejects unknown authorization roles and statuses', () => {
    expect(
      profileSchema.safeParse({
        id: '00000000-0000-0000-0000-000000000001',
        full_name: 'Member Example',
        chapter_id: null,
        role: 'owner',
        status: 'approved',
      }).success,
    ).toBe(false)
    expect(
      profileSchema.safeParse({
        id: '00000000-0000-0000-0000-000000000001',
        full_name: 'Member Example',
        chapter_id: null,
        role: 'member',
        status: 'active',
      }).success,
    ).toBe(false)
  })
})
