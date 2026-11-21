// T857: what an item waits for, as the row, the item page and the menu say it: the unfinished ones only, a merged one
// followed to where it went; and what it holds up.
import { expect, test } from 'vitest'
import { item } from '../stories/fixtures'
import { holdsUp, waitsFor } from './items'

test('waits for the unfinished ones, a merged one followed; holds up who waits for it', () => {
  const items = [
    item({ n: 1, status: 'done' }),
    item({ n: 2, status: 'open', mergedInto: 3 }),
    item({ n: 3, status: 'doing' }),
    item({ n: 4, status: 'open', after: [1, 2] }),
    item({ n: 5, status: 'done', after: [3] }),
  ]
  const byN = new Map(items.map((it) => [it.n, it]))
  expect(waitsFor(byN, items[3]).map((it) => it.n)).toEqual([3])
  expect(holdsUp(items, items[0]).map((it) => it.n)).toEqual([4])
  expect(holdsUp(items, items[2])).toEqual([])
})
