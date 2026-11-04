import { describe, expect, test } from 'vitest'
import { when } from './time'

describe('a time, one way everywhere (R4-5 #5)', () => {
  const now = new Date(2026, 9, 23, 18, 0).getTime()
  test('today its time, yesterday so said, older its day and time, another year its date', () => {
    expect(when(new Date(2026, 9, 23, 14, 30).toISOString(), now)).toBe('14:30')
    expect(when(new Date(2026, 9, 22, 9, 5).toISOString(), now)).toBe('Yesterday 09:05')
    expect(when(new Date(2026, 9, 21, 14, 30).toISOString(), now)).toBe('Oct 21 14:30')
    expect(when(new Date(2025, 9, 21, 14, 30).toISOString(), now)).toBe('Oct 21, 2025')
  })
})
