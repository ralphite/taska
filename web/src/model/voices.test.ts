// B682 (Yadong: every voice note has its words, bound to the voice, the same everywhere): the page reads a voice
// note's words from its one record wherever the note shows, and sends what was typed apart from the notes' words.
import { describe, expect, test } from 'vitest'
import { merge, project } from './project'
import { outgoingLine } from './outgoing'
import { splitVoices } from './voices'
import type { Comment, Doc, Input, Item, ViewAnswer, Voice } from './types'

const F = 'f4-voice_0-12.webm'
const WORDS = 'Keep the filter, and the sort as well.'
const voiceFile = { f: F, name: 'voice_0-12.webm', mime: 'audio/webm' }
const rec = (f: Partial<Voice> = {}): Voice => ({ f: F, state: 'done', said: 'Keep the filter, and, um, the sort as well.', tidied: WORDS, ...f })
const input: Input = { id: 'r22', t: '', by: 'you', text: '', scope: 12, files: [voiceFile], acked: false, touched: [], org: null, seq: 5, v: 0 }
const item = { n: 12, code: 'F12', type: 'feature', title: 'Export', body: '', pri: 'P2', when: 'now', status: 'open', parent: null, next: '', srcs: ['r22'], mergedInto: null, archived: false, t0: '', t1: '', by: 'you', wait: null, talked: true, thread: [{ id: 5, by: 'you', kind: 'say', text: '', t: '', src: 'r22', files: [] }] } as Item
const comment: Comment = { id: 9, key: 'doc', th: 9, quote: '', text: 'About this:', by: 'you', t: '', files: [{ ...voiceFile, f: 'f5-voice_0-03.webm' }] }
const doc = { d: 1, n: 12, title: 'D', md: '', t0: '', t1: '', by: 'codex', versions: 1, fmt: 'md', blocks: [], detached: [], whole: [comment], unanswered: 0, resolved: {} } as Doc
const answer = (voices: Voice[]): ViewAnswer =>
  ({ cursor: '1', full: true, items: [item], inputs: [input], docs: [doc], voices, project: { width: 2 }, server: { page: '', update: false } }) as unknown as ViewAnswer

describe('every place that shows a voice note shows its record’s words', () => {
  const m = project(merge(null, answer([rec(), rec({ f: 'f5-voice_0-03.webm', tidied: 'And the sort too?', said: 'And the sort too?' })]), 0))

  test('the input, your message of it and a voice comment', () => {
    expect(m.byId.get('r22')?.text).toBe(WORDS)
    expect(m.byId.get('r22')?.typed).toBe('')
    expect(m.byId.get('r22')?.files[0].voice?.said).toBe('Keep the filter, and, um, the sort as well.')
    expect(m.byN.get(12)?.thread[0].text).toBe(WORDS)
    expect(m.docs[0].whole[0].text).toBe('About this:\nAnd the sort too?')
  })

  test('words changed once are changed everywhere', () => {
    const copy = merge(merge(null, answer([rec()]), 0), { cursor: '2', full: false, items: [], inputs: [], docs: [], voices: [rec({ tidied: 'Keep the filter and the sort.', fixed: 't' })] } as unknown as ViewAnswer, 1)
    const now = project(copy)
    expect(now.byId.get('r22')?.text).toBe('Keep the filter and the sort.')
    expect(now.byN.get(12)?.thread[0].text).toBe('Keep the filter and the sort.')
  })

  test('a note still being worked out shows its first words, and says it is coming on its way', () => {
    const now = project(merge(null, answer([rec({ state: 'wait', tidied: '', said: '', early: 'Keep the filter' })]), 0))
    expect(now.byId.get('r22')?.text).toBe('Keep the filter')
    expect(outgoingLine({ text: '', files: [voiceFile] }, new Map([[F, rec({ state: 'wait', tidied: '', said: '' })]]))).toBe('Transcribing…')
    expect(outgoingLine({ text: '', files: [voiceFile] }, new Map([[F, rec()]]))).toBe(WORDS)
  })
})

describe('sending, what was typed and each voice note’s words go apart', () => {
  test('the words as they were put in', () => {
    expect(splitVoices(`See this\n${WORDS}`, [{ f: 'k1', words: WORDS }])).toEqual({ text: 'See this', words: { k1: WORDS } })
  })

  test('the words as you changed them in the box', () => {
    const changed = 'Keep the filter you set, and the sort as well.'
    expect(splitVoices(`See this\n${changed}`, [{ f: 'k1', words: WORDS }])).toEqual({ text: 'See this', words: { k1: changed } })
  })

  test('words changed past finding are found by what was around them', () => {
    expect(splitVoices('Typed first\nsomething else entirely', [{ f: 'k1', words: WORDS, around: ['Typed first', ''] }])).toEqual({ text: 'Typed first', words: { k1: 'something else entirely' } })
  })

  test('an edit begins with what was typed, then the words', () => {
    expect(splitVoices('Typed\nKeep the filter only.', [{ f: F, words: WORDS }], 'Typed')).toEqual({ text: 'Typed', words: { [F]: 'Keep the filter only.' } })
  })
})
