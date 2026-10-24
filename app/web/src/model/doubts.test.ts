import { describe, expect, it } from 'vitest'
import { fixIn, fixRange, openDoubts, pickSide, spotsIn, unmarked, voiceStretches } from './doubts'

const text = 'Before. Put it in the side bar, the side bar stays. After.'
const f = { key: 'v', trAdded: 'Put it in the side bar, the side bar stays.', doubts: [{ was: 'side bar', alt: 'sidebar', why: '' }] }

describe('misheard words', () => {
  it('finds every place of a doubt, none overlapping', () => {
    expect(spotsIn(text, [f]).map((p) => text.slice(p.s, p.e))).toEqual(['side bar', 'side bar'])
    expect(openDoubts(text, [f])).toHaveLength(1)
  })
  it('swaps a side everywhere and keeps the voice stretch', () => {
    const r = pickSide(text, f, 0, 'alt')
    expect(r.text).toBe('Before. Put it in the sidebar, the sidebar stays. After.')
    expect(r.trAdded).toBe('Put it in the sidebar, the sidebar stays.')
    expect(r.doubts[0].pick).toBe('alt')
    const back = pickSide(r.text, { ...f, trAdded: r.trAdded, doubts: r.doubts }, 0, 'was')
    expect(back.text).toBe(text)
  })
  it('corrects words inside the voice note', () => {
    const at = fixRange(text, 7, 12)
    expect(at).toEqual({ s: 8, e: 11, wrong: 'Put' })
    const r = fixIn(text, [f], at as { s: number; e: number; wrong: string }, 'Place')
    expect(r?.text.startsWith('Before. Place it')).toBe(true)
    expect(r?.files[0].trAdded.startsWith('Place it')).toBe(true)
    expect(voiceStretches(text, [f])).toEqual([[8, 8 + f.trAdded.length]])
  })
  it('takes the model mark out', () => expect(unmarked('colours (?)')).toBe('colours'))
})
