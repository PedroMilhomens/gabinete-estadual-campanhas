import { describe, expect, it } from 'vitest'
import {
  calculateChapterRankings,
  csvCell,
  reviewFormSchema,
} from './review-schema'

const chapterA = '11111111-1111-4111-8111-111111111111'
const chapterB = '22222222-2222-4222-8222-222222222222'

function rankingRecord(
  chapterId: string,
  name: string,
  score: number | null,
  status: 'draft' | 'submitted' | 'returned' | 'approved',
) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    chapter_id: chapterId,
    status,
    score,
    chapter: {
      id: chapterId,
      name,
      number: chapterId === chapterA ? 1 : 2,
    },
    activity: {
      campaign_id: '44444444-4444-4444-8444-444444444444',
      campaign: { id: '44444444-4444-4444-8444-444444444444', name: 'Campaign' },
    },
  }
}

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

describe('calculateChapterRankings', () => {
  it('sums approved scores and excludes unreviewed submissions', () => {
    expect(
      calculateChapterRankings([
        rankingRecord(chapterA, 'Capítulo A', 12, 'approved'),
        rankingRecord(chapterA, 'Capítulo A', 8, 'approved'),
        rankingRecord(chapterB, 'Capítulo B', 50, 'submitted'),
        rankingRecord(chapterB, 'Capítulo B', null, 'approved'),
        rankingRecord(chapterB, 'Capítulo B', 19, 'approved'),
      ]),
    ).toEqual([
      {
        chapterId: chapterB,
        chapterName: 'Capítulo B',
        chapterNumber: 2,
        totalScore: 19,
        approvedSubmissions: 1,
      },
      {
        chapterId: chapterA,
        chapterName: 'Capítulo A',
        chapterNumber: 1,
        totalScore: 20,
        approvedSubmissions: 2,
      },
    ].sort((a, b) => b.totalScore - a.totalScore))
  })
})

describe('csvCell', () => {
  it('escapes quotes and wraps fields safely', () => {
    expect(csvCell('A "quoted", value')).toBe('"A ""quoted"", value"')
    expect(csvCell(null)).toBe('""')
    expect(csvCell('=1+1')).toBe(`"'=1+1"`)
  })
})
