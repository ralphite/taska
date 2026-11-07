import { describe, expect, it } from 'vitest'
import { listedActions } from '../app/actions'
import { HOME, RIGHT, SHOP } from '../stories/searchFixtures'
import { searchDialogView, type DialogNow, type DialogPlace } from './searchDialogView'

const place: DialogPlace = {
  here: 'shop',
  model: (s) => (s === 'shop' ? SHOP : s === 'home' ? HOME : null),
  title: (s) => (s === 'shop' ? 'Shop' : 'Home'),
  tone: () => '',
  projects: ['shop', 'home'],
  recent: [{ project: 'shop', kind: 'items', n: 2, code: 'B002', title: 'Saving drops the last word' }],
  actions: [...listedActions(true), ...listedActions(false)],
  openCode: 'F001',
}
const now = (p: Partial<DialogNow>): DialogNow => ({ phase: 'found', words: 'export filter', added: '', heard: [], answer: RIGHT, kind: 'all', typed: true, ms: 0, levels: [], project: null, status: null, sel: 0, replace: false, ...p })

describe("the desktop search's dialog", () => {
  it('lists what it found by kind in All, each kind named and best first, each row with its project as a path (T642 R9 (D115, 11-06))', () => {
    const v = searchDialogView(now({}), place)
    expect(v.results.map((l) => l.code)).toEqual(['F001', 'F003', 'T014', 'F006', 'F021', '#8', '#4', 'Rules', 'D1'])
    expect(v.results.filter((l) => l.head).map((l) => [l.code, l.head])).toEqual([
      ['F001', 'Items'],
      ['#8', 'Inputs'],
      ['Rules', 'Rules'],
      ['D1', 'Documents'],
    ])
    // one kind: best first, no names over it
    expect(searchDialogView(now({ kind: 'items' }), place).results.some((l) => l.head)).toBe(false)
    expect(v.results.find((l) => l.code === 'T014')?.path).toBe('Shop / F001')
    expect(v.results.find((l) => l.code === 'F021')?.path).toBe('Home')
  })

  it('narrows to a kind, a project, a status; the kinds count what the filters leave', () => {
    expect(searchDialogView(now({ project: 'home' }), place).results.map((l) => l.code)).toEqual(['F021', '#4'])
    const open = searchDialogView(now({ status: 'open' }), place)
    expect(open.results.every((l) => l.mark.kind === 'item')).toBe(true)
    expect(searchDialogView(now({ kind: 'rules' }), place).results.map((l) => l.code)).toEqual(['Rules']) // a section of the rules document (I693)
    expect(searchDialogView(now({ project: 'home' }), place).kinds?.find((k) => k.value === 'all')?.count).toBe(2)
  })

  it('shows Recent while nothing is typed, and the actions the words name, on the item open', () => {
    expect(searchDialogView(now({ words: '', answer: null, phase: 'ready' }), place).recent.map((l) => l.code)).toEqual(['B002'])
    const done = searchDialogView(now({ words: 'done', answer: null, phase: 'nothing' }), place)
    expect(done.actions.map((a) => [a.id, a.sub])).toEqual([['done', 'F001']])
    expect(done.middle).toBeNull()
    expect(searchDialogView(now({ words: 'zzz', answer: null, phase: 'nothing' }), place).middle).toBe('nothing')
  })
})
