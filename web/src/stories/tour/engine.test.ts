import { describe, expect, it } from 'vitest'
import { advance, begin, finished, missing, type Look, type Run } from './engine'
import { button, gone, shows, type Tour } from './tour'

const look = (o: Partial<Look> = {}): Look => ({ now: 0, target: true, subject: false, tapped: false, next: false, ...o })
const A = button('A')
const B = button('B')

describe('a tour', () => {
  it('goes step by step: a tap, Next, a screen that shows it', () => {
    const tour: Tour = { steps: [{ say: 'tap A', target: A }, { say: 'look', next: true }, { say: 'open B', target: A, until: shows(B) }] }
    let r: Run = begin(0)
    r = advance(tour, r, look({ now: 10 }))
    expect(r.i).toBe(0)
    r = advance(tour, r, look({ now: 20, tapped: true }))
    expect(r).toMatchObject({ i: 1, since: 20 })
    r = advance(tour, r, look({ now: 30, tapped: true }))
    expect(r.i).toBe(1)
    r = advance(tour, r, look({ now: 40, next: true }))
    expect(r.i).toBe(2)
    r = advance(tour, r, look({ now: 50 }))
    expect(r.i).toBe(2)
    r = advance(tour, r, look({ now: 60, subject: true }))
    expect(finished(tour, r)).toBe(true)
    expect(r.skipped).toEqual([])
  })

  it('moves one step a frame, even when the next is done already, and notes a step done before it began', () => {
    const tour: Tour = { steps: [{ say: 'tap A', target: A }, { say: 'B is there', target: A, until: shows(B) }, { say: 'tap A', target: A }] }
    let r = advance(tour, begin(0), look({ now: 1, tapped: true, subject: true }))
    expect(r.i).toBe(1)
    r = advance(tour, r, look({ now: 2, subject: true }))
    expect(r.i).toBe(2)
    expect(r.skipped).toEqual([1])
  })

  it('judges until only once its part is found or its wait is over', () => {
    const tour: Tour = { steps: [{ say: 'B is there', target: A, until: shows(B), wait: 100 }] }
    let r = advance(tour, begin(0), look({ now: 50, target: false, subject: true }))
    expect(r.i).toBe(0)
    r = advance(tour, r, look({ now: 100, target: false, subject: true }))
    expect(r.i).toBe(1)
  })

  it('takes gone only after its part was seen in this step', () => {
    const tour: Tour = { steps: [{ say: 'send', target: B, until: gone(B) }] }
    // never there (a misspelt name, say): not done, however long
    let r = advance(tour, begin(0), look({ now: 5000, target: false }))
    expect(r.i).toBe(0)
    r = advance(tour, r, look({ now: 5010, subject: true }))
    expect(r).toMatchObject({ i: 0, saw: true })
    r = advance(tour, r, look({ now: 5020, subject: false }))
    expect(r.i).toBe(1)
    expect(r.skipped).toEqual([])
  })

  it('says its part is missing once the wait is over', () => {
    const tour: Tour = { steps: [{ say: 'tap A', target: A, wait: 2000 }, { say: 'look', next: true }] }
    const r = begin(0)
    expect(missing(tour, r, { now: 1999, target: false })).toBe(false)
    expect(missing(tour, r, { now: 2000, target: false })).toBe(true)
    expect(missing(tour, r, { now: 2000, target: true })).toBe(false)
    // a step that names no part is never missing one
    expect(missing(tour, { ...r, i: 1 }, { now: 9000, target: false })).toBe(false)
  })

  it('keeps the same run when nothing changes', () => {
    const tour: Tour = { steps: [{ say: 'tap A', target: A }] }
    const r = begin(0)
    expect(advance(tour, r, look({ now: 10 }))).toBe(r)
  })
})
