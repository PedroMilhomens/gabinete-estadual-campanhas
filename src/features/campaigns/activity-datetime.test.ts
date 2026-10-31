import { describe, expect, it } from 'vitest'
import {
  getLocalDateTimeParts,
  localDateTimeToIso,
} from './activity-datetime'

describe('activity date and time conversion', () => {
  it('round-trips the selected local date and 24-hour time', () => {
    const localDate = '2026-11-15'
    const localTime = '02:00'
    const timestamp = localDateTimeToIso(localDate, localTime)

    expect(getLocalDateTimeParts(timestamp)).toEqual({
      date: localDate,
      time: localTime,
    })
  })

  it('rejects invalid date/time values', () => {
    expect(() => localDateTimeToIso('2026-02-31', '14:30')).toThrow(
      RangeError,
    )
    expect(() => localDateTimeToIso('2026-11-15', '2:00 AM')).toThrow(
      RangeError,
    )
  })

  it('rejects invalid saved timestamps', () => {
    expect(() => getLocalDateTimeParts('invalid')).toThrow(RangeError)
  })
})
