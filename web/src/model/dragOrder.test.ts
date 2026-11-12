// B754 (Yadong r1258): any item that can be dragged can be put in order among its group of the list (in review too):
// near another's top or bottom it goes before or after it, over the middle it goes under it.
import { describe, expect, test } from 'vitest'
import { item } from '../stories/fixtures'
import { dropOn, ranksFor } from './items'
import { inWorkOrder } from './visible'
import { NO_FILTERS } from './route'

const a = item({ n: 1, status: 'review', when: 'now' })
const b = item({ n: 2, status: 'review', when: 'now' })
const c = item({ n: 3, status: 'open', when: 'now' })
const d = item({ n: 4, status: 'doing', when: 'now' })
const all = [a, b, c, d]
const byN = new Map(all.map((it) => [it.n, it]))

describe('putting items in order by dragging', () => {
  test('work in review goes before or after another near its top or bottom, under it over the middle', () => {
    expect(dropOn(byN, 2, 1, 0.1)).toEqual({ n: 1, how: 'before' })
    expect(dropOn(byN, 2, 1, 0.9)).toEqual({ n: 1, how: 'after' })
    expect(dropOn(byN, 2, 1, 0.5)).toEqual({ n: 1, how: 'into' })
    expect(dropOn(byN, 1, 3, 0.1)).toEqual({ n: 3, how: 'before' }) // in review and open are one group of the list
  })

  test('another group of the list, or a list not in this order: only under it', () => {
    expect(dropOn(byN, 1, 4, 0.1)).toEqual({ n: 4, how: 'into' }) // in progress comes first, a group of its own
    expect(dropOn(byN, 2, 1, 0.1, false)).toEqual({ n: 1, how: 'into' })
    expect(inWorkOrder('items', NO_FILTERS)).toBe(true)
    expect(inWorkOrder('items', { ...NO_FILTERS, status: 'wait' })).toBe(false)
  })

  test('the ranks put it there in its group, the others keeping their order', () => {
    const ranks = ranksFor(all, byN, 2, 1, false)
    const order = [...ranks].sort((x, y) => x.rank - y.rank).map((p) => p.n)
    expect(order).toEqual([2, 1, 3])
  })
})
