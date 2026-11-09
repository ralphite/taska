import { describe, expect, test } from 'vitest'
import { ago, dayLabel, laterDay, laterDays, when } from './time'

describe('a time, one way everywhere (R4-5 #5)', () => {
  const now = new Date(2026, 9, 23, 18, 0).getTime()
  test('today its time, yesterday so said, older its day and time, another year its date', () => {
    expect(when(new Date(2026, 9, 23, 14, 30).toISOString(), now)).toBe('14:30')
    expect(when(new Date(2026, 9, 22, 9, 5).toISOString(), now)).toBe('Yesterday 09:05')
    expect(when(new Date(2026, 9, 21, 14, 30).toISOString(), now)).toBe('Oct 21 14:30')
    expect(when(new Date(2025, 9, 21, 14, 30).toISOString(), now)).toBe('Oct 21, 2025')
  })
})

describe('how long ago, one module, its words by where it shows (Refactor 10)', () => {
  const now = Date.parse('2026-11-08T12:00:00Z')
  const before = (min: number) => now - min * 60e3
  test('short beside a name or a line, ago on a quiet line, long in a sentence', () => {
    expect([0, 5, 120, 3 * 1440].map((m) => ago(before(m), now, 'short'))).toEqual(['now', '5m', '2h', '3d'])
    expect([0.5, 5, 120].map((m) => ago(before(m), now, 'ago'))).toEqual(['just now', '5m ago', '2h ago'])
    expect([0, 5, 120, 1440, 3 * 1440].map((m) => ago(new Date(before(m)).toISOString(), now, 'long'))).toEqual(['just now', '5 min ago', '2 h ago', '1 day ago', '3 days ago'])
  })
  test('a day as lists group by it: Today, Yesterday, its date (another year with it)', () => {
    const at = new Date(2026, 10, 8, 18, 0).getTime()
    expect(dayLabel(new Date(2026, 10, 8, 9).toISOString(), at)).toBe('Today')
    expect(dayLabel(new Date(2026, 10, 7, 9).toISOString(), at)).toBe('Yesterday')
    expect(dayLabel(new Date(2026, 10, 2, 9).toISOString(), at)).toBe('Nov 2')
    expect(dayLabel(new Date(2025, 10, 2, 9).toISOString(), at)).toBe('Nov 2, 2025')
  })
})

describe('Later until a day (D115 #21)', () => {
  const thu = new Date(2026, 10, 5, 9, 0).getTime() // Thursday Nov 5
  test('tomorrow, and next week its Monday', () => {
    expect(laterDays(thu)).toEqual({ today: '2026-11-05', tomorrow: '2026-11-06', nextWeek: '2026-11-09' })
    expect(laterDays(new Date(2026, 10, 9, 9, 0).getTime()).nextWeek).toBe('2026-11-16') // from a Monday: the next one
    // from a Sunday: not tomorrow's Monday, the one after (R6-1 #4)
    expect(laterDays(new Date(2026, 10, 8, 9, 0).getTime())).toMatchObject({ tomorrow: '2026-11-09', nextWeek: '2026-11-16' })
  })
  test('within the week its weekday, further its date', () => {
    expect(laterDay('2026-11-09', thu)).toBe('Mon')
    expect(laterDay('2026-11-21', thu)).toBe('Nov 21')
  })
})
