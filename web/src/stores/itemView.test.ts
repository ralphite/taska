// Yadong's rule (B835, r1430): in a question of one choice, the one picked, tapped again, is unpicked, so a slip can
// be taken back. Changing it needs his word.
import { describe, expect, it } from 'vitest'
import { createItemViewStore } from './itemView'
import { memoryStore } from './storage'

describe('picking choices', () => {
  const labels = ['yes', 'no']
  it('one choice: another replaces it; the one picked, tapped again, is unpicked', () => {
    const s = createItemViewStore(memoryStore())
    s.getState().pick(1, 0, false, new Set(), labels)
    expect([...s.getState().choice!.picked]).toEqual([0])
    s.getState().pick(1, 1, false, s.getState().choice!.picked, labels)
    expect([...s.getState().choice!.picked]).toEqual([1])
    s.getState().pick(1, 1, false, s.getState().choice!.picked, labels)
    expect(s.getState().choice!.picked.size).toBe(0)
  })
  it('many: each tap ticks or unticks', () => {
    const s = createItemViewStore(memoryStore())
    s.getState().pick(1, 0, true, new Set(), labels)
    s.getState().pick(1, 1, true, s.getState().choice!.picked, labels)
    s.getState().pick(1, 0, true, s.getState().choice!.picked, labels)
    expect([...s.getState().choice!.picked]).toEqual([1])
  })
})
