// T589 #10486: a row swiped open on the phone closes when the list is drawn anew: the drawing's key changes when a
// row's task changes (Done, Later, Won't do, a subtask done) or a row comes or goes, never when the page draws the
// same rows again.
import { describe, expect, test } from 'vitest'
import { task, modelOf } from '../../stories/fixtures'
import { NO_FILTERS } from '../../model/route'
import type { Task } from '../../model/types'
import { drawRows } from './drawRows'
import { drawingKey } from './TaskList'
import { listBody } from './rows'

const st = { folded: new Set<number>(), subMore: new Set<number>(), needsAll: false, open: null, desk: false }
const keyOf = (tasks: Task[]) => {
  const m = modelOf(tasks)
  const b = listBody(m, 'tasks', NO_FILTERS, st)
  const rows = b.kind === 'rows' ? b.rows : []
  return drawingKey(drawRows(m, rows, { slug: 'demo', openN: null, selected: new Set(), words: [], desk: false, drafts: new Set(), head: undefined, seen: { since: '' }, drag: { n: null, at: null } }))
}
const parent = task({ n: 1, title: 'Export' })
const kid = task({ n: 2, parent: 1, title: 'CSV' })
const other = task({ n: 3, title: 'Sort by priority' })

describe('the list drawn anew (T589 #10486)', () => {
  test('the same rows drawn again: the same key', () => {
    expect(keyOf([parent, kid, other])).toBe(keyOf([{ ...parent }, { ...kid }, { ...other }]))
  })
  test('a row’s task Done, Later, Won’t do: another key', () => {
    const was = keyOf([parent, kid, other])
    expect(keyOf([parent, kid, { ...other, status: 'done' }])).not.toBe(was)
    expect(keyOf([parent, kid, { ...other, when: 'later' }])).not.toBe(was)
    expect(keyOf([parent, kid, { ...other, status: 'dropped' }])).not.toBe(was)
  })
  test('a subtask done: another key', () => {
    expect(keyOf([parent, { ...kid, status: 'done' }, other])).not.toBe(keyOf([parent, kid, other]))
  })
  test('a row gone: another key', () => {
    expect(keyOf([parent, kid])).not.toBe(keyOf([parent, kid, other]))
  })
})
