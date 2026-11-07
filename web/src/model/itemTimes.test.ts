import { describe, expect, test } from 'vitest'
import { itemTimes } from './itemTimes'

// F704 r1157: one quiet line under the item's chips, "Nov 3 by Organizer · Updated 2h ago"; both times in full on a tap
// (the phone's sheet) or under the pointer (the desktop's tip).
describe('when an item was made and last changed (F704 r1157)', () => {
  const now = new Date(2026, 10, 6, 16, 40).getTime()
  const t = (mo: number, d: number, h: number, mi: number, y = 2026) => new Date(y, mo, d, h, mi).toISOString()

  test('the line: its day and who made it, then how long ago it changed', () => {
    const x = itemTimes({ t0: t(10, 3, 9, 12), t1: t(10, 6, 14, 38), by: 'org' }, now)
    expect([x.made, x.updated]).toEqual(['Nov 3 by Organizer', 'Updated 2h ago'])
  })

  test('both in full: today said as such, and who made it', () => {
    const x = itemTimes({ t0: t(10, 3, 9, 12), t1: t(10, 6, 14, 38), by: 'org' }, now)
    expect(x.created).toEqual({ at: 'Nov 3 09:12', by: 'by Organizer' })
    expect(x.last).toBe('Today 14:38')
    expect(x.tip).toBe('Created Nov 3 09:12 by Organizer\nUpdated Today 14:38')
  })

  test('who: you, an agent by its name, nobody when not known', () => {
    const at = { t0: t(10, 3, 9, 12), t1: t(10, 3, 9, 12) }
    expect(itemTimes({ ...at, by: 'you' }, now).made).toBe('Nov 3 by you')
    expect(itemTimes({ ...at, by: 'claude-code' }, now).made).toBe('Nov 3 by Claude Code')
    expect(itemTimes({ ...at, by: null }, now).made).toBe('Nov 3')
    expect(itemTimes({ ...at, by: null }, now).tip).toBe('Created Nov 3 09:12')
  })

  test('not changed since (or only in its first minute): no Updated', () => {
    const x = itemTimes({ t0: t(10, 3, 9, 12), t1: t(10, 3, 9, 12), by: 'org' }, now)
    expect([x.updated, x.last]).toEqual([null, null])
    expect(x.tip).toBe('Created Nov 3 09:12 by Organizer')
    expect(itemTimes({ t0: new Date(2026, 10, 3, 9, 12, 0).toISOString(), t1: new Date(2026, 10, 3, 9, 12, 40).toISOString(), by: 'org' }, now).updated).toBeNull()
  })

  test('how long ago: just now, minutes, days within the week, then the day', () => {
    const made = t(9, 1, 9, 0)
    const up = (t1: string) => itemTimes({ t0: made, t1, by: null }, now).updated
    expect(up(new Date(now - 20e3).toISOString())).toBe('Updated just now')
    expect(up(new Date(now - 5 * 60e3).toISOString())).toBe('Updated 5m ago')
    expect(up(new Date(now - 3 * 864e5).toISOString())).toBe('Updated 3d ago')
    expect(up(t(9, 21, 10, 0))).toBe('Updated Oct 21')
  })

  test('another year: its year, and in full its time too', () => {
    const x = itemTimes({ t0: t(9, 21, 14, 30, 2025), t1: t(9, 21, 14, 30, 2025), by: 'you' }, now)
    expect(x.made).toBe('Oct 21, 2025 by you')
    expect(x.created.at).toBe('Oct 21, 2025 14:30')
  })
})
