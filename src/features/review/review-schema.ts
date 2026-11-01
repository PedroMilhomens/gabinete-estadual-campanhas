import { z } from 'zod'

export const REVIEWABLE_STATUSES = ['returned', 'approved'] as const

export const reviewFormSchema = z.object({
  score: z.number().int('A pontuação precisa ser um número inteiro.').min(0),
  status: z.enum(REVIEWABLE_STATUSES),
  comment: z
    .string()
    .trim()
    .min(1, 'Informe um comentário para a decisão.')
    .max(2000, 'O comentário deve ter no máximo 2.000 caracteres.'),
})

export const internalActivityPointsSchema = z.object({
  activityId: z.string().uuid(),
  chapterId: z.string().uuid(),
  score: z.number().int('A pontuação precisa ser um número inteiro.').min(0),
})

export const chapterRankingSchema = z.object({
  chapter_id: z.string().uuid(),
  chapter_name: z.string(),
  chapter_number: z.number().int().nullable(),
  total_score: z.number().int().nonnegative(),
  approved_submissions: z.number().int().nonnegative(),
})

const chapterSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  number: z.number().int().nullable(),
})

const campaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

const activitySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  points: z.number().int().nullable(),
  campaign_id: z.string().uuid().nullable(),
  campaign: campaignSchema.nullable(),
})

export const reviewSubmissionSchema = z.object({
  id: z.string().uuid(),
  activity_id: z.string().uuid(),
  chapter_id: z.string().uuid(),
  submitted_by: z.string().uuid().nullable(),
  description: z.string().nullable(),
  status: z.enum(['draft', 'submitted', 'returned', 'approved']),
  score: z.number().int().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
  chapter: chapterSchema,
  activity: activitySchema,
  submitter: z.object({ full_name: z.string() }).nullable(),
  attachments: z.array(
    z.object({
      id: z.string().uuid(),
      storage_path: z.string(),
      mime: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
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

export const reviewListItemSchema = reviewSubmissionSchema.omit({
  reviewed_at: true,
  attachments: true,
  comments: true,
})

export type ReviewFormValues = z.infer<typeof reviewFormSchema>
export type InternalActivityPointsValues = z.infer<typeof internalActivityPointsSchema>
export type ChapterRankingRecord = z.infer<typeof chapterRankingSchema>
export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>
export type ReviewListItem = z.infer<typeof reviewListItemSchema>

export function csvCell(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
