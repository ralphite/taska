import { afterEach, describe, expect, test, vi } from 'vitest'
import { Refused, Unreachable, untilAnswered } from './http'

afterEach(() => vi.useRealTimers())

describe('asking until Taska answers', () => {
  test('out of reach it waits, says so once, and asks again until the answer comes', async () => {
    vi.useFakeTimers()
    let n = 0
    const waiting = vi.fn()
    const got = untilAnswered(async () => {
      if (++n < 3) throw new Unreachable(false)
      return 'made'
    }, waiting)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    await expect(got).resolves.toBe('made')
    expect(n).toBe(3)
    expect(waiting).toHaveBeenCalledTimes(1)
  })

  test('a refusal comes back at once', async () => {
    let n = 0
    await expect(untilAnswered(async () => (n++, Promise.reject(new Refused('A project of that name exists'))))).rejects.toThrow('A project of that name exists')
    expect(n).toBe(1)
  })
})
