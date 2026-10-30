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
  submitted_by: z.string().uuid(),
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

export const rankingRecordSchema = z.object({
  id: z.string().uuid(),
  chapter_id: z.string().uuid(),
  status: z.enum(['draft', 'submitted', 'returned', 'approved']),
  score: z.number().int().nullable(),
  chapter: chapterSchema,
  activity: z.object({
    campaign_id: z.string().uuid().nullable(),
    campaign: campaignSchema.nullable(),
  }),
})

export type ReviewFormValues = z.infer<typeof reviewFormSchema>
export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>
export type ReviewListItem = z.infer<typeof reviewListItemSchema>
export type RankingRecord = z.infer<typeof rankingRecordSchema>

export type ChapterRanking = {
  chapterId: string
  chapterName: string
  chapterNumber: number | null
  totalScore: number
  approvedSubmissions: number
}

export function calculateChapterRankings(records: RankingRecord[]) {
  const chapters = new Map<string, ChapterRanking>()

  for (const record of records) {
    if (record.status !== 'approved' || record.score === null) continue

    const current = chapters.get(record.chapter_id) ?? {
      chapterId: record.chapter_id,
      chapterName: record.chapter.name,
      chapterNumber: record.chapter.number,
      totalScore: 0,
      approvedSubmissions: 0,
    }

    current.totalScore += record.score
    current.approvedSubmissions += 1
    chapters.set(record.chapter_id, current)
  }

  return [...chapters.values()].sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      a.chapterName.localeCompare(b.chapterName, 'pt-BR'),
  )
}

export function csvCell(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
