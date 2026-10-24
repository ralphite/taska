import { describe, expect, it } from 'vitest'
import type { Doc } from './types'
import { notSent, vcCount, vcLabel, vcLineEnd, vcSegments, withQuote } from './voiceComments'

const doc = { d: 4, blocks: [{ key: 'a', text: 'First part', comments: [] }, { key: 'b', text: 'Second **part**', comments: [] }] } as unknown as Doc

describe('voice comments', () => {
  it('puts a quote line in and the words under it', () => {
    const t = withQuote('hello', vcLabel('Second **part**'))
    expect(t).toBe('hello\n\n> “Second part”\n')
    expect(vcCount(t)).toBe(1)
    expect(vcLineEnd(t, 'Second part')).toBe(t.length)
  })
  it('splits the box into comments, words above the first quote going with it', () => {
    const r = vcSegments('note\n> “First part”\nsaid one\n> “Second part”\nsaid two', doc, [{ label: 'First part', d: 4, key: 'a', quote: 'First part' }])
    expect('segs' in r && r.segs.map((s) => [s.key, s.text])).toEqual([
      ['a', 'note\n\nsaid one'],
      ['b', 'said two'],
    ])
    expect(vcSegments('> “Gone words”\nx', doc, [])).toEqual({ err: '“Gone words” is no longer in D4: change or remove the quote line' })
  })
  it('lists what is not sent while the box holds it', () => {
    const marks = [{ label: 'First part', d: 4, key: 'a', quote: 'First part' }, { label: 'Second part', d: 4, key: 'b', quote: 'x' }]
    expect(notSent('> “First part”\nhi', [{ vc: 'Second part', transcribing: true }], marks, 4)).toEqual([
      { label: 'First part', key: 'a', words: 'hi', voice: 0, transcribing: false },
      { label: 'Second part', key: 'b', words: '', voice: 1, transcribing: true },
    ])
  })
})
