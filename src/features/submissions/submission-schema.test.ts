import { describe, expect, it } from 'vitest'
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS,
  attachmentFileSchema,
  submissionFormSchema,
} from './submission-schema'

describe('submissionFormSchema', () => {
  it('accepts empty drafts and descriptions within the database limit', () => {
    expect(submissionFormSchema.safeParse({ description: '' }).success).toBe(
      true,
    )
    expect(
      submissionFormSchema.safeParse({
        description: 'x'.repeat(5000),
      }).success,
    ).toBe(true)
  })

  it('rejects descriptions longer than 5000 characters', () => {
    expect(
      submissionFormSchema.safeParse({
        description: 'x'.repeat(5001),
      }).success,
    ).toBe(false)
  })
})

describe('attachment limits', () => {
  it('matches the database bucket constraints', () => {
    expect(MAX_ATTACHMENT_SIZE).toBe(5 * 1024 * 1024)
    expect(MAX_ATTACHMENTS).toBe(5)
    expect(ALLOWED_ATTACHMENT_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'application/pdf',
    ])
  })

  it('rejects disallowed MIME types and files larger than 5 MB', () => {
    expect(
      attachmentFileSchema.safeParse({
        type: 'text/plain',
        size: 100,
      }).success,
    ).toBe(false)
    expect(
      attachmentFileSchema.safeParse({
        type: 'image/png',
        size: MAX_ATTACHMENT_SIZE + 1,
      }).success,
    ).toBe(false)
  })
})
