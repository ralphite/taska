// The page's pure rules: the copy of the server's data, the address, what needs you, the queue's order, which items a
// list shows.

import { describe, expect, it as test } from 'vitest'
import { item, message, projectFacts } from '../stories/fixtures'
import { needsYou, queueHead, queueOrder } from './items'
import { merge, patched, project } from './project'
import { NO_FILTERS, parseRoute, projectPath } from './route'
import type { ViewAnswer } from './types'
import { visible } from './visible'

const answer = (a: Partial<ViewAnswer>): ViewAnswer => ({ cursor: 'c1', full: false, items: [], inputs: [], docs: [], project: projectFacts(), server: { page: '', update: false }, ...a })

describe('the copy of the server’s data', () => {
  test('a full answer replaces it, a delta changes and removes, a same answer keeps it', () => {
    const full = merge(null, answer({ full: true, items: [item({ n: 1 }), item({ n: 2 })] }), 1)
    expect([...full.items.keys()]).toEqual([1, 2])
    const delta = merge(full, answer({ cursor: 'c2', items: [item({ n: 2, title: 'New title' })], removed: { items: [1], inputs: [], docs: [] } }), 2)
    expect([...delta.items.keys()]).toEqual([2])
    expect(delta.items.get(2)?.title).toBe('New title')
    const same = merge(delta, answer({ cursor: 'c3', same: true }), 3)
    expect(same.items).toBe(delta.items)
    expect([same.cursor, same.at]).toEqual(['c3', 3])
  })

  test('a question on a closed item is history', () => {
    const c = merge(null, answer({ full: true, items: [item({ n: 1, status: 'done', wait: { id: 1, kind: 'ask', text: '?', by: 'codex', files: [] } })] }), 1)
    expect(c.items.get(1)?.wait).toBeNull()
  })

  test('reopening an archived item brings it back; your pending change shows over the copy', () => {
    expect(patched(item({ n: 1, status: 'done', archived: true }), { status: 'open' }).archived).toBe(false)
    const c = merge(null, answer({ full: true, items: [item({ n: 1 })] }), 1)
    expect(project(c, [{ n: 1, f: { status: 'done' } }]).byN.get(1)?.status).toBe('done')
  })
})

describe('the address', () => {
  test('places and the list’s settings read back the way they were written', () => {
    const list = { ...NO_FILTERS, q: 'export', status: 'wait' }
    for (const place of [{ kind: 'tab' }, { kind: 'item', ref: 'F12' }, { kind: 'doc', d: 3 }, { kind: 'new' }] as const) {
      const path = projectPath('taska', 'items', place, list)
      const [p, s] = path.split('?')
      const r = parseRoute(p, s ? '?' + s : '')
      expect(r).toMatchObject({ page: 'project', slug: 'taska', place, list })
    }
  })

  test('an old link with the item after # opens it', () => {
    expect(parseRoute('/p/taska/', '', '#B03')).toMatchObject({ place: { kind: 'item', ref: 'B03' } })
  })
})

describe('what needs you and the queue', () => {
  test('a question, or a proposal you have not answered, needs you; finished and archived work does not', () => {
    expect(needsYou(item({ n: 1, wait: { id: 1, kind: 'ask', text: '?', by: 'codex', files: [] } }))).toBe(true)
    expect(needsYou(item({ n: 1, status: 'proposed' }))).toBe(true)
    expect(needsYou(item({ n: 1, status: 'proposed', talked: true }))).toBe(false)
    expect(needsYou(item({ n: 1, status: 'proposed', archived: true }))).toBe(false)
    expect(needsYou(item({ n: 1, status: 'done' }))).toBe(false)
  })

  test('in progress first, then the order you set, then priority; Later last', () => {
    const items = [
      item({ n: 1, pri: 'P2' }),
      item({ n: 2, pri: 'P1' }),
      item({ n: 3, pri: 'P2', status: 'doing' }),
      item({ n: 4, pri: 'P0', when: 'later' }),
      item({ n: 5, pri: 'P3', rank: 1 }),
    ]
    expect(queueOrder(items).map((x) => x.n)).toEqual([3, 2, 1, 5, 4])
    expect(queueHead(items)).toBe(2)
  })
})

describe('which items a list shows', () => {
  const items = [
    item({ n: 1, title: 'Export ignores the filter' }),
    item({ n: 2, status: 'done', title: 'Sort by priority' }),
    item({ n: 3, type: 'rule', title: 'Commit in English' }),
    item({ n: 4, archived: true, title: 'Old export' }),
    item({ n: 5, title: 'Talk', thread: [message({ id: 1, text: 'the CSV export keeps every row' })] }),
  ]
  const ns = (tab: Parameters<typeof visible>[1], list: Partial<typeof NO_FILTERS>) => visible(items, tab, { ...NO_FILTERS, ...list }).map((x) => x.n)

  test('Items shows open work now; the archive and the rules have their own tabs', () => {
    expect(ns('items', {})).toEqual([1, 5])
    expect(ns('items', { status: 'closed' })).toEqual([2])
    expect(ns('archive', {})).toEqual([4])
    expect(ns('rules', {})).toEqual([3])
  })

  test('the search finds words in the title and in the talk', () => {
    expect(ns('items', { q: 'export', status: 'every' })).toEqual([1, 5])
  })
})
