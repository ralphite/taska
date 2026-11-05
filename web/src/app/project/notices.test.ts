import { describe, expect, test } from 'vitest'
import { inQuiet } from './notices'

describe('quiet hours (D115 #43), kept as the server keeps a phone’s', () => {
  const at = (h: number, m = 0) => h * 60 + m
  test('over midnight', () => {
    const night = { from: '22:00', to: '08:00' }
    expect([at(23), at(7, 59), at(8), at(12)].map((t) => inQuiet(night, t))).toEqual([true, true, false, false])
  })
  test('within a day, and none when from is to', () => {
    expect([at(12, 30), at(23)].map((t) => inQuiet({ from: '12:00', to: '13:00' }, t))).toEqual([true, false])
    expect(inQuiet({ from: '10:00', to: '10:00' }, at(10))).toBe(false)
  })
})
