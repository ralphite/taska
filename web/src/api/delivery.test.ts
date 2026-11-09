import { afterEach, describe, expect, test, vi } from 'vitest'
import { Abandoned, Refused, Unreachable } from './http'
import { Delivery } from './delivery'

afterEach(() => vi.useRealTimers())

describe('getting something to Taska', () => {
  test('out of reach it waits, says so once, and asks again until the answer comes', async () => {
    vi.useFakeTimers()
    let n = 0
    const waiting = vi.fn()
    const got = new Delivery().until(async () => {
      if (++n < 3) throw new Unreachable(false)
      return 'made'
    }, { waiting })
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    await expect(got).resolves.toBe('made')
    expect(n).toBe(3)
    expect(waiting).toHaveBeenCalledTimes(1)
  })

  test('a refusal comes back at once', async () => {
    let n = 0
    await expect(new Delivery().until(async () => (n++, Promise.reject(new Refused('A project of that name exists'))))).rejects.toThrow('A project of that name exists')
    expect(n).toBe(1)
  })

  test('the pauses grow to 30 s and are never given up', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 50].map(Delivery.pause)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000])
  })

  test('Taska back: what waits goes at once', async () => {
    vi.useFakeTimers()
    const d = new Delivery()
    let n = 0
    const got = d.until(async () => {
      if (++n < 3) throw new Unreachable(true)
      return n
    })
    await vi.advanceTimersByTimeAsync(0)
    d.back()
    await vi.advanceTimersByTimeAsync(0)
    d.back()
    await vi.advanceTimersByTimeAsync(0)
    await expect(got).resolves.toBe(3)
  })

  test('what it was for gone: it ends', async () => {
    vi.useFakeTimers()
    let n = 0
    const got = new Delivery().until(async () => (n++, Promise.reject(new Unreachable(false))), { again: () => n < 2 })
    const seen = expect(got).rejects.toBeInstanceOf(Abandoned)
    await vi.advanceTimersByTimeAsync(5000)
    await seen
    expect(n).toBe(2)
  })
})
