import { describe, expect, it } from 'vitest'
import { U, byN, code, inQueue, needsYou, parseRef, queueHead, sideProjects, visible } from './state'
import { ask, item, load } from '../test/fixture'
import type { Wait } from './types'

describe('what needs you, and the queue', () => {
  it('an open question, a proposal and work in review need you; finished work does not', () => {
    load([
      item(1, { wait: ask(1, 'Which one?') as unknown as Wait }),
      item(2, { status: 'proposed' }),
      item(3, { status: 'review' }),
      item(4, { status: 'review', reply: true }),
      item(5, { status: 'done', wait: ask(5, 'old') as unknown as Wait }),
      item(6),
    ])
    const by = (n: number) => byN.get(n)!
    expect([1, 2, 3, 4, 5, 6].filter((n) => needsYou(by(n)))).toEqual([1, 2, 3])
  })
  it('every count of what needs you is the same number: the sidebar, the Needs you view, the list (B482)', () => {
    load([
      item(1, { wait: ask(1, 'Which one?') as unknown as Wait }),
      item(2, { status: 'proposed' }),
      item(3, { status: 'review' }),
      item(4, { wait: ask(4, 'Archived while it asks') as unknown as Wait, archived: true }), // off the list: off the counts
      item(5, { type: 'rule', wait: ask(5, 'A rule asks') as unknown as Wait }), // waits on you: in Items too
      item(6, { type: 'rule', status: 'proposed' }),
      item(7, { status: 'review', reply: true }),
      item(8, { status: 'done', wait: ask(8, 'old') as unknown as Wait }),
      item(9, { when: 'later', status: 'proposed' }),
    ])
    const was = U.status
    U.status = 'wait'
    const view = visible('items').map((it) => it.n)
    U.status = was
    expect(view).toEqual(expect.arrayContaining([1, 2, 3, 5, 6, 9]))
    expect(view.length).toBe(6)
    expect(sideProjects().find((p) => p.name === 'demo')?.needs).toBe(view.length)
    expect([...byN.values()].filter(needsYou).length).toBe(view.length)
  })
  it('the queue takes now before later, then priority, then age', () => {
    load([
      item(1, { pri: 'P2' }),
      item(2, { pri: 'P0', when: 'later' }),
      item(3, { pri: 'P1' }),
      item(4, { pri: 'P1' }),
    ])
    expect(visible('items').filter(inQueue).length).toBe(3) // Active (the default view) leaves later out (F291, r397)
    expect(queueHead()).toBe(3)
  })
  it('codes are padded to the widest number and read back in any form', () => {
    load([item(3, { type: 'bug' }), item(12)], { width: 2 })
    expect(code(3)).toBe('B03')
    expect(parseRef('b3')).toBe(3)
    expect(parseRef('B003')).toBe(3)
    expect(parseRef('x')).toBe(null)
  })
  it('a search looks in titles, bodies and the talk', () => {
    load([item(1, { title: 'Export ignores filter' }), item(2, { body: 'the filter is lost' }), item(3)])
    U.q = 'filter'
    expect(visible('items').map((it) => it.n)).toEqual([1, 2])
    U.q = ''
  })
})
