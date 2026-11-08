// T589 #10486: a row swiped open on the phone closes when the list is drawn anew: the drawing's key changes when a
// row's item changes (Done, Later, Won't do, a subitem done) or a row comes or goes, never when the page draws the
// same rows again.
import { describe, expect, test } from 'vitest'
import { item, modelOf } from '../../stories/fixtures'
import { NO_FILTERS } from '../../model/route'
import type { Item } from '../../model/types'
import { drawRows } from './drawRows'
import { drawingKey } from './ItemList'
import { listBody } from './rows'

const st = { folded: new Set<number>(), subMore: new Set<number>(), needsAll: false, open: null, desk: false }
const keyOf = (items: Item[]) => {
  const m = modelOf(items)
  const b = listBody(m, 'items', NO_FILTERS, st)
  const rows = b.kind === 'rows' ? b.rows : []
  return drawingKey(drawRows(m, rows, { slug: 'demo', openN: null, selected: new Set(), words: [], desk: false, drafts: new Set(), head: undefined, seen: { since: '' }, drag: { n: null, at: null } }))
}
const parent = item({ n: 1, title: 'Export' })
const kid = item({ n: 2, parent: 1, title: 'CSV' })
const other = item({ n: 3, title: 'Sort by priority' })

describe('the list drawn anew (T589 #10486)', () => {
  test('the same rows drawn again: the same key', () => {
    expect(keyOf([parent, kid, other])).toBe(keyOf([{ ...parent }, { ...kid }, { ...other }]))
  })
  test('a row’s item Done, Later, Won’t do: another key', () => {
    const was = keyOf([parent, kid, other])
    expect(keyOf([parent, kid, { ...other, status: 'done' }])).not.toBe(was)
    expect(keyOf([parent, kid, { ...other, when: 'later' }])).not.toBe(was)
    expect(keyOf([parent, kid, { ...other, status: 'dropped' }])).not.toBe(was)
  })
  test('a subitem done: another key', () => {
    expect(keyOf([parent, { ...kid, status: 'done' }, other])).not.toBe(keyOf([parent, kid, other]))
  })
  test('a row gone: another key', () => {
    expect(keyOf([parent, kid])).not.toBe(keyOf([parent, kid, other]))
  })
})
