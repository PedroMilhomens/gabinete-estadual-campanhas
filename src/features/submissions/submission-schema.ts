import { z } from 'zod'

export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024
export const MAX_ATTACHMENTS = 5
export const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const

export const attachmentFileSchema = z.object({
  type: z.enum(ALLOWED_ATTACHMENT_TYPES),
  size: z.number().int().nonnegative().max(MAX_ATTACHMENT_SIZE),
})

export const submissionFormSchema = z.object({
  description: z
    .string()
    .trim()
    .max(5000, 'A descrição deve ter no máximo 5.000 caracteres.'),
})

export const submissionSchema = z.object({
  id: z.string().uuid(),
  activity_id: z.string().uuid(),
  chapter_id: z.string().uuid(),
  submitted_by: z.string().uuid(),
  description: z.string().nullable(),
  status: z.enum(['draft', 'submitted', 'returned', 'approved']),
  score: z.number().int().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
  activity: z.object({
    id: z.string().uuid(),
    name: z.string(),
    points: z.number().int().nullable(),
    due_at: z.string().nullable(),
    campaign: z.object({ name: z.string() }).nullable(),
  }),
  attachments: z.array(
    z.object({
      id: z.string().uuid(),
      storage_path: z.string(),
      mime: z.enum(ALLOWED_ATTACHMENT_TYPES),
      size_bytes: z.number().int().nonnegative(),
    }),
  ),
  comments: z.array(
    z.object({
      id: z.string().uuid(),
      body: z.string().nullable(),
      created_at: z.string(),
      author: z.object({ full_name: z.string() }).nullable(),
    }),
  ),
})

export const submissionListItemSchema = z.object({
  id: z.string().uuid(),
  activity_id: z.string().uuid(),
  chapter_id: z.string().uuid(),
  submitted_by: z.string().uuid(),
  description: z.string().nullable(),
  status: z.enum(['draft', 'submitted', 'returned', 'approved']),
  score: z.number().int().nullable(),
  created_at: z.string(),
  activity: z.object({
    name: z.string(),
    campaign: z.object({ name: z.string() }).nullable(),
  }),
})

export type Submission = z.infer<typeof submissionSchema>
export type SubmissionListItem = z.infer<typeof submissionListItemSchema>
