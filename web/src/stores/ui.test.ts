// Yadong's rule (T876, r1483): a parent or group folded stays folded when the page is opened again (on the phone
// too): kept in this browser, for each project. Changing it needs his word.
import { describe, expect, it } from 'vitest'
import { createUiStore } from './ui'
import { memoryStore } from './storage'

describe('folded parents', () => {
  it('a page opened again shows the parents folded as they were left, each project its own', () => {
    const kv = memoryStore()
    const a = createUiStore(kv)
    a.getState().reset('taska')
    a.getState().toggleFold(3)
    a.getState().toggleFold(7)
    a.getState().reset('home')
    expect(a.getState().folded.size).toBe(0)
    a.getState().toggleFold(2)

    const b = createUiStore(kv) // a fresh page
    b.getState().reset('taska')
    expect([...b.getState().folded].sort()).toEqual([3, 7])
    b.getState().toggleFold(3) // opened again
    b.getState().reset('home')
    expect([...b.getState().folded]).toEqual([2])
    b.getState().reset('taska')
    expect([...b.getState().folded]).toEqual([7])
  })
  it('all opened again: nothing is kept', () => {
    const kv = memoryStore()
    const s = createUiStore(kv)
    s.getState().reset('taska')
    s.getState().toggleFold(3)
    s.getState().unfold(3)
    expect(kv.keys()).toEqual([])
  })
})
