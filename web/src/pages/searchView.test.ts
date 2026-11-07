import { describe, expect, it } from 'vitest'
import { noRowEvents, T } from '../stories/fixtures'
import { HOME, ORDER, RIGHT, SHOP } from '../stories/searchFixtures'
import { searchView, type SearchNow, type SearchPlace } from './searchView'

const place: SearchPlace = {
  here: 'shop',
  m: SHOP,
  order: ORDER,
  tone: () => '',
  seen: { since: T },
  drafts: new Set(),
  on: () => noRowEvents,
  now: Date.parse('2026-11-02T18:00:00-08:00'),
  recent: [],
  model: (s) => (s === 'shop' ? SHOP : s === 'home' ? HOME : null),
}
const now = (p: Partial<SearchNow>): SearchNow => ({ phase: 'found', words: RIGHT.q, added: '', heard: [], answer: RIGHT, kind: 'all', typed: false, ms: 0, levels: [], ...p })
const shown = (kind: SearchNow['kind']) => searchView(now({ kind }), place).groups?.map((g) => [g.project, g.rows.map((r) => (r.head ? `${r.head}: ` : '') + r.key)])

describe("the phone search's page", () => {
  it('in All, puts each project\'s rows by kind, each kind named over its first row (T642 R9 (D115, 11-06))', () => {
    expect(shown('all')).toEqual([
      ['shop', ['Items: shop/i1', 'shop/i3', 'shop/i14', 'shop/i6', 'Inputs: shop/r8', 'Rules: shop/i17', 'Documents: shop/d1']],
      ['home', ['Items: home/i21', 'Inputs: home/r4']],
    ])
  })
  it('names no kind when one kind is shown', () => {
    expect(shown('items')).toEqual([
      ['shop', ['shop/i1', 'shop/i3', 'shop/i14', 'shop/i6']],
      ['home', ['home/i21']],
    ])
  })
})
