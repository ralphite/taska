// The page's pure rules: the copy of the server's data, the address, what needs you, the queue's order, which items a
// list shows.

import { describe, expect, it as test } from 'vitest'
import { input, item, message, modelOf, projectFacts } from '../stories/fixtures'
import { needsYou, queueHead, queueOrder } from './items'
import { merge, patched, project } from './project'
import { NO_FILTERS, parseRoute, projectPath } from './route'
import type { ViewAnswer } from './types'
import { visible } from './visible'
import { becameOf } from './became'
import { canSend, organizing } from './inputs'

const answer = (a: Partial<ViewAnswer>): ViewAnswer => ({ cursor: 'c1', full: false, items: [], inputs: [], docs: [], project: projectFacts(), server: { page: '', update: false }, ...a })

describe("the copy of the server's data", () => {
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
  test("places and the list's settings read back the way they were written", () => {
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
    expect(ns('items', { status: 'done' })).toEqual([2])
    expect(ns('items', { status: 'open' })).toEqual([1, 5])
    expect(ns('archive', {})).toEqual([4])
    expect(ns('rules', {})).toEqual([3])
  })

  test('the search finds words in the title and in the talk', () => {
    expect(ns('items', { q: 'export', status: 'every' })).toEqual([1, 5])
  })
})

describe('a recording cancelled with Esc, kept in the inputs (B627)', () => {
  const organizer = { on: true, busy: [] as string[] }
  const kept = { t: '', by: 'you', text: 'Keep the columns too', scope: null, files: [], acked: false, touched: [], org: null, seq: 1, v: 0, id: 'r4', kind: 'cancelled' as const }

  test("it stands as cancelled, is no one's work, and can be sent", () => {
    const m = project({ cursor: '', items: new Map(), inputs: new Map([[kept.id, kept]]), docs: new Map(), facts: projectFacts({ organizer: { ...organizer, model: '' } }), server: { page: '', update: false }, at: 0 })
    expect(becameOf(kept, m, (s) => s)).toEqual({ k: 'cancelled' })
    expect(organizing(kept, organizer)).toBe(false)
    expect(canSend(kept)).toBe(true)
    expect(canSend({ ...kept, moved: { to: 'other', as: 'r1' } })).toBe(false)
  })

  test('Send shows it sent at once: an ordinary new input, waiting for the organizer', () => {
    const copy = { cursor: '', items: new Map(), inputs: new Map([[kept.id, kept]]), docs: new Map(), facts: projectFacts(), server: { page: '', update: false }, at: 0 }
    const sent = project(copy, [], 0, [{ id: kept.id, f: { kind: undefined } }]).byId.get(kept.id)!
    expect(canSend(sent)).toBe(false)
    expect(becameOf(sent, project({ ...copy, facts: projectFacts({ organizer: { ...organizer, model: '' } }) }), (s) => s)).toEqual({ k: 'organizing' })
    expect(organizing(sent, organizer)).toBe(true)
  })

  test('B684: an input the organizer has not finished reads Organizing whether it is on it, next or trying again', () => {
    const copy = { cursor: '', items: new Map(), inputs: new Map([[kept.id, kept]]), docs: new Map(), facts: projectFacts(), server: { page: '', update: false }, at: 0 }
    const sent = project(copy, [], 0, [{ id: kept.id, f: { kind: undefined } }]).byId.get(kept.id)!
    for (const busy of [[sent.id], ['r999'], []])
      expect(becameOf(sent, project({ ...copy, facts: projectFacts({ organizer: { model: '', ...organizer, busy } }) }), (s) => s)).toEqual({ k: 'organizing' })
  })
})

describe('what became of an input, in one set of words (B629)', () => {
  const m = modelOf([item({ n: 14, type: 'bug' }), item({ n: 12 }), item({ n: 7, type: 'task' })], [], { organizer: { on: true, model: '', busy: [] } })
  const org = (msg: string, f = {}) => ({ ok: true, msg, t: '', keep: false, changed: true, undone: false, ...f })
  const of = (f: Parameters<typeof input>[0]) => becameOf(input(f), m, (s) => (s === 'mobile-app' ? 'Mobile app' : s))

  test("the organizer's note says what was done to each item, and what else it says stays as a note", () => {
    const b = of({ id: 'r1', acked: true, touched: [14, 12, 7], org: org('Created B014; added to F012 and T007 · asked about the sort') })
    expect(b).toMatchObject({ k: 'filed', note: 'asked about the sort' })
    expect(b.k === 'filed' && b.items.map((x) => [x.item.code, x.did])).toEqual([['B014', 'Created'], ['F012', 'Added to'], ['T007', 'Added to']])
  })

  test('where one stands when no item came of it', () => {
    expect(of({ id: 'r2', org: org('B99 is not in this project', { ok: false }) })).toEqual({ k: 'failed', why: 'B99 is not in this project', retry: true })
    // the service's own words in plain ones; Taska's own reason as it is
    expect(of({ id: 'r2', org: org('Gemini HTTP 503: overloaded', { ok: false }) })).toMatchObject({ k: 'failed', why: 'busy' })
    // its key refused: where to fix it, and Retry once it is fixed (nothing asks again by itself)
    expect(of({ id: 'r2', org: org('Gemini HTTP 401: API key not valid', { ok: false }) })).toMatchObject({ k: 'failed', why: 'Gemini key not accepted · check GEMINI_API_KEY on the server', retry: true })
    expect(of({ id: 'r2', org: org('B500 is not in this project', { ok: false }) })).toMatchObject({ k: 'failed', why: 'B500 is not in this project' })
    expect(of({ id: 'r3', org: org('Left for your agent', { keep: true }) })).toEqual({ k: 'agent' })
    expect(of({ id: 'r4', acked: true, org: org('Left for your agent', { keep: true }) })).toEqual({ k: 'handled' })
    expect(of({ id: 'r5', acked: true, org: org('Nothing to file: a thank-you') })).toEqual({ k: 'note', text: 'Nothing to file: a thank-you' })
    expect(of({ id: 'r6', acked: true, kind: 'answer', scope: 7 })).toMatchObject({ k: 'answer', item: { code: 'T007' } })
    expect(of({ id: 'r7', acked: true, moved: { to: 'mobile-app', as: 'r4' } })).toEqual({ k: 'moved', to: 'Mobile app', as: '#4', href: '/p/mobile-app/' })
  })
})
