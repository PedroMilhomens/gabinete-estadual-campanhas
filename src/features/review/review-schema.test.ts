import { describe, expect, it } from 'vitest'
import {
  chapterRankingSchema,
  csvCell,
  internalActivityPointsSchema,
  reviewFormSchema,
} from './review-schema'

describe('reviewFormSchema', () => {
  it('accepts a bounded score with a decision and comment', () => {
    expect(
      reviewFormSchema.safeParse({
        score: 10,
        status: 'approved',
        comment: 'Bom trabalho.',
      }).success,
    ).toBe(true)
  })

  it('requires an integer non-negative score and non-empty comment', () => {
    expect(
      reviewFormSchema.safeParse({
        score: -1,
        status: 'approved',
        comment: 'Comentário',
      }).success,
    ).toBe(false)
    expect(
      reviewFormSchema.safeParse({
        score: 1.5,
        status: 'returned',
        comment: 'Comentário',
      }).success,
    ).toBe(false)
    expect(
      reviewFormSchema.safeParse({
        score: 1,
        status: 'returned',
        comment: ' ',
      }).success,
    ).toBe(false)
  })
})

describe('internalActivityPointsSchema', () => {
  const record = {
    activityId: '11111111-1111-4111-8111-111111111111',
    chapterId: '22222222-2222-4222-8222-222222222222',
    score: 10,
  }

  it('accepts a valid staff scoring record', () => {
    expect(internalActivityPointsSchema.safeParse(record).success).toBe(true)
  })

  it('rejects invalid identifiers and fractional scores', () => {
    expect(internalActivityPointsSchema.safeParse({ ...record, activityId: 'invalid' }).success).toBe(false)
    expect(internalActivityPointsSchema.safeParse({ ...record, score: 1.5 }).success).toBe(false)
  })
})

describe('chapterRankingSchema', () => {
  it('validates aggregated ranking rows', () => {
    expect(
      chapterRankingSchema.safeParse({
        chapter_id: '11111111-1111-4111-8111-111111111111',
        chapter_name: 'Capítulo A',
        chapter_number: 1,
        total_score: 25,
        approved_submissions: 2,
      }).success,
    ).toBe(true)
  })
})

describe('csvCell', () => {
  it('escapes quotes and wraps fields safely', () => {
    expect(csvCell('A "quoted", value')).toBe('"A ""quoted"", value"')
    expect(csvCell(null)).toBe('""')
    expect(csvCell('=1+1')).toBe(`"'=1+1"`)
  })
})
