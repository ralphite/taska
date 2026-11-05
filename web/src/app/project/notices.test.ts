import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Need } from '../../model/types'
import { createDataStore } from '../../stores/data'
import { memoryStore } from '../../stores/storage'
import { Notices, inQuiet, type NoticesDeps } from './notices'

describe("the app's icon counts what needs you in every project (D115 #19)", () => {
  const need = (code: string): Need => ({ project: 'p', ptitle: 'P', n: 1, code, title: 't', kind: 'ask', pri: 'P2', t: '' })
  afterEach(() => vi.unstubAllGlobals())
  test('counted as what needs you changes; off in Settings, no count; where the browser cannot, nothing', () => {
    const set = vi.fn(() => Promise.resolve())
    const clear = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, setAppBadge: set, clearAppBadge: clear })
    const data = createDataStore([], [need('F1'), need('B2')])
    const n = new Notices(memoryStore(), () => {}, { data, slug: () => '', desk: () => true } as unknown as NoticesDeps)
    expect(set).toHaveBeenLastCalledWith(2)
    data.getState().setProjects([], [need('F1'), need('B2'), need('T3')], 1)
    expect(set).toHaveBeenLastCalledWith(3)
    n.setBadgeOn(false)
    expect(clear).toHaveBeenCalled()
    vi.stubGlobal('navigator', {})
    expect(Notices.badgeable()).toBe(false)
    n.stop()
  })
})

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
