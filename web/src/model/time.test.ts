import { describe, expect, test } from 'vitest'
import { laterDay, laterDays, when } from './time'

describe('a time, one way everywhere (R4-5 #5)', () => {
  const now = new Date(2026, 9, 23, 18, 0).getTime()
  test('today its time, yesterday so said, older its day and time, another year its date', () => {
    expect(when(new Date(2026, 9, 23, 14, 30).toISOString(), now)).toBe('14:30')
    expect(when(new Date(2026, 9, 22, 9, 5).toISOString(), now)).toBe('Yesterday 09:05')
    expect(when(new Date(2026, 9, 21, 14, 30).toISOString(), now)).toBe('Oct 21 14:30')
    expect(when(new Date(2025, 9, 21, 14, 30).toISOString(), now)).toBe('Oct 21, 2025')
  })
})

describe('Later until a day (D115 #21)', () => {
  const thu = new Date(2026, 10, 5, 9, 0).getTime() // Thursday Nov 5
  test('tomorrow, and next week its Monday', () => {
    expect(laterDays(thu)).toEqual({ today: '2026-11-05', tomorrow: '2026-11-06', nextWeek: '2026-11-09' })
    expect(laterDays(new Date(2026, 10, 9, 9, 0).getTime()).nextWeek).toBe('2026-11-16') // from a Monday: the next one
  })
  test('within the week its weekday, further its date', () => {
    expect(laterDay('2026-11-09', thu)).toBe('Mon')
    expect(laterDay('2026-11-21', thu)).toBe('Nov 21')
  })
})
