import { describe, expect, it } from 'vitest'
import { byKind, foundGroups, foundKinds, foundLine, foundMeta, foundPath, heardWords, saidMore, type FindAnswer, type Found } from './find'

const f = (project: string, kind: Found['kind'], key: string, more: Partial<Found> = {}): Found => ({ project, kind, key, n: 1, ...more })
const A: FindAnswer = {
  q: 'export filter',
  by: 'meaning',
  marks: ['export'],
  titles: { shop: 'Shop', home: 'Home', work: 'Work' },
  found: [f('home', 'items', 'i21'), f('shop', 'items', 'i1'), f('work', 'docs', 'd2'), f('shop', 'inputs', 'r8'), f('shop', 'rules', 'i17')],
}

describe('the phone search', () => {
  it('groups by project: the one you are in first, then the sidebar order, closest first in each', () => {
    expect(foundGroups(A, 'shop', ['work', 'home'], 'all').map((g) => [g.project, g.rows.map((x) => x.key)])).toEqual([
      ['shop', ['i1', 'r8', 'i17']],
      ['work', ['d2']],
      ['home', ['i21']],
    ])
    expect(foundGroups(A, 'shop', ['work', 'home'], 'items').map((g) => g.project)).toEqual(['shop', 'home'])
    expect(foundKinds(A)).toEqual([
      ['items', 'Items', 2],
      ['inputs', 'Inputs', 1],
      ['rules', 'Rules', 1],
      ['docs', 'Documents', 1],
    ])
  })

  it('says more at the end of the words, lit, as a sentence goes on', () => {
    expect(saidMore('', 'Where the export loses my filter.')).toEqual({ words: 'Where the export loses my filter', added: '' })
    expect(saidMore('where the export loses my filter', 'Only on the phone.')).toEqual({ words: 'where the export loses my filter, only on the phone', added: ', only on the phone' })
    expect(saidMore('导出丢了筛选。', '只在手机上')).toEqual({ words: '导出丢了筛选，只在手机上', added: '，只在手机上' })
    expect(saidMore('API keys', 'API too')).toEqual({ words: 'API keys, API too', added: ', API too' })
    expect(heardWords(' Find the export. ')).toBe('Find the export')
  })

  it('says when an input was said and what it became, and opens what it became', () => {
    // the same day wherever the test runs (CI is UTC): local times, not a fixed offset
    const now = new Date(2026, 10, 2, 18, 0).getTime()
    const said = f('shop', 'inputs', 'r12', { t: new Date(2026, 10, 2, 9, 12).toISOString(), became: 'B018', n: 18 })
    expect(foundMeta(said, now)).toMatch(/^\d\d:\d\d · became B018$/)
    expect(foundMeta(f('shop', 'docs', 'd1', { on: 'F001' }), now)).toBe('On F001')
    expect(foundPath(said)).toBe('/p/shop/B018')
    expect(foundPath(f('shop', 'docs', 'd1', { d: 1 }))).toBe('/p/shop/D1')
  })

  it('opens an input not yet filed as itself, where it is listed, with no words in the address (r1092, T689 #2)', () => {
    expect(foundPath(f('shop', 'inputs', 'r8', { title: 'The export should keep the filter', became: null }))).toBe('/p/shop/inputs#r8')
  })

  it("says each on one line for the home page: what it is after its project's name", () => {
    expect(foundLine(f('shop', 'inputs', 'r8', { code: '#8', title: 'The export should keep the filter' }))).toEqual({ code: '#8', title: 'The export should keep the filter', where: ' · what you said' })
    expect(foundLine(f('shop', 'docs', 'd2', { code: 'D2', title: 'Plan' })).where).toBe(' · a document')
  })
})

describe('All, by kind (T642 R9 (D115, 11-06))', () => {
  const rows = A.found.map((found) => ({ found }))
  it("puts the rows together by kind in the chips' order, each closest first, its name over the first", () => {
    expect(byKind(rows).map((r) => [r.found.key, r.head ?? ''])).toEqual([
      ['i21', 'Items'],
      ['i1', ''],
      ['r8', 'Inputs'],
      ['i17', 'Rules'],
      ['d2', 'Documents'],
    ])
  })
  it('names no kind when only one is there, or when told not to', () => {
    expect(byKind(rows.filter((r) => r.found.kind === 'items')).some((r) => r.head)).toBe(false)
    expect(byKind(rows, false).some((r) => r.head)).toBe(false)
    expect(byKind(rows.slice(0, 1), true)[0].head).toBe('Items')
  })
})
