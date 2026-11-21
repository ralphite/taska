// T856: a group is never done by itself and never in the agents' queue: its row and its swipes offer Archive (and
// Later), never Done or Won't do.
import { expect, test } from 'vitest'
import { item } from '../stories/fixtures'
import { backward, deskSlots, forward } from './actions'
import { queuedNow } from './items'

const group = item({ n: 1, group: true, status: 'open' })

test('a group: Archive forward, Later back, never Done or Won\'t do; not in the queue', () => {
  expect(forward(group)?.[2]).toBe('archive')
  expect(deskSlots(group, false).filter(Boolean).map((s) => s?.[2])).toEqual(['archive', 'later'])
  expect(backward(group).map((s) => s[2])).toEqual(['later'])
  expect(queuedNow(group)).toBe(false)
  expect(queuedNow(item({ n: 2, status: 'open' }))).toBe(true)
})

test('made a group, or a task again: said in words, never "undefined" (the desktop threw on it)', async () => {
  const { heldWord, saidOf } = await import('../app/items/itemActions')
  const m = { byN: new Map(), width: 1 } as unknown as Parameters<typeof saidOf>[0]
  expect([saidOf(m, 'group', true, false), saidOf(m, 'group', false, true)]).toEqual(['is now a group', 'is a task again'])
  expect(heldWord('group', true, saidOf(m, 'group', true, false))).toBe('A group')
})
