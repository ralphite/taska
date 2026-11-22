// T857: what a task waits for, as the row, the task page and the menu say it: the unfinished ones only, a merged one
// followed to where it went; and what it holds up.
import { expect, test } from 'vitest'
import { task } from '../stories/fixtures'
import { holdsUp, waitsFor } from './tasks'

test('waits for the unfinished ones, a merged one followed; holds up who waits for it', () => {
  const tasks = [
    task({ n: 1, status: 'done' }),
    task({ n: 2, status: 'open', mergedInto: 3 }),
    task({ n: 3, status: 'doing' }),
    task({ n: 4, status: 'open', after: [1, 2] }),
    task({ n: 5, status: 'done', after: [3] }),
  ]
  const byN = new Map(tasks.map((it) => [it.n, it]))
  expect(waitsFor(byN, tasks[3]).map((it) => it.n)).toEqual([3])
  expect(holdsUp(tasks, tasks[0]).map((it) => it.n)).toEqual([4])
  expect(holdsUp(tasks, tasks[2])).toEqual([])
})

test('one done and waiting for your acceptance (review) holds nothing up (T872)', () => {
  const tasks = [task({ n: 1, status: 'review' }), task({ n: 2, status: 'open', after: [1] })]
  expect(waitsFor(new Map(tasks.map((it) => [it.n, it])), tasks[1])).toEqual([])
})
