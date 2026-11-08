// A voice message's states (T726): every state shows something defined in every place, nothing goes a way the table
// does not have, a refused upload says so (B725), a message sent with its fast words goes on as its words come, and
// docs/voice.md is made from the table.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { input, item, modelOf, record, shown, waiting } from '../stories/fixtures'
import { becameOf } from './became'
import type { Input, WordsAnswer } from './types'
import {
  NOTE_STOPPED,
  VOICE_PLACES,
  VOICE_STATE_LIST,
  VOICE_STATES,
  VOICE_STEPS,
  canGo,
  heardEvent,
  noteState,
  noteStep,
  notesState,
  sayIn,
  sentState,
  showIn,
  voiceDiagram,
  voicePlacesTable,
  type NoteFields,
  type VoiceEvent,
  type VoiceState,
} from './voiceStates'

const NOTE = { mime: 'audio/webm' }
/** a draft's note moved on by each event in turn, as the page does it */
function walk(events: VoiceEvent[], f: NoteFields = { ...NOTE, ...NOTE_STOPPED }): { f: NoteFields; toasts: string[] } {
  const toasts: string[] = []
  for (const on of events) {
    const s = noteStep(f, 'draft', on)
    if (!s) throw new Error(`${noteState(f)} cannot go on ${on}`)
    f = { ...f, ...s.change }
    if (s.toast) toasts.push(s.toast)
  }
  return { f, toasts }
}

describe('the states', () => {
  test('every state has a rule for every place', () => {
    for (const s of VOICE_STATE_LIST) for (const p of Object.keys(VOICE_PLACES)) expect(VOICE_STATES[s].show, `${s} in ${p}`).toHaveProperty(p)
    for (const s of VOICE_STATE_LIST) for (const p of Object.keys(VOICE_PLACES) as (keyof typeof VOICE_PLACES)[]) expect(showIn(s, p)).not.toBeUndefined()
  })

  test('every state can be reached from the start, and every way joins two states', () => {
    const reached = new Set<VoiceState>()
    let more = true
    while (more) {
      more = false
      for (const s of VOICE_STEPS)
        if ((s.from === null || reached.has(s.from)) && !reached.has(s.to)) {
          reached.add(s.to)
          more = true
        }
    }
    expect([...reached].sort()).toEqual([...VOICE_STATE_LIST].sort())
  })

  test('a note in a draft goes exactly to the state the table says, for every way it can go', () => {
    const fields: Partial<Record<VoiceState, NoteFields>> = {
      uploading: { ...NOTE, uploading: true, transcript: 'wait' },
      transcribing: { ...NOTE, transcript: 'wait' },
      fastWords: { ...NOTE, transcript: 'fast' },
      words: { ...NOTE, transcript: 'done' },
      noWords: { ...NOTE, transcript: 'none' },
      wordsFailed: { ...NOTE, transcript: 'failed' },
      uploadFailed: { ...NOTE, failed: true, transcript: 'wait' },
    }
    for (const [state, f] of Object.entries(fields) as [VoiceState, NoteFields][]) {
      expect(noteState(f)).toBe(state)
      for (const step of VOICE_STEPS.filter((s) => s.from === state && VOICE_STATES[s.to].phase === 'draft')) {
        const s = noteStep(f, 'draft', step.on)
        expect(s, `${state} on ${step.on}`).not.toBeNull()
        expect(noteState({ ...f, ...s?.change }), `${state} on ${step.on}`).toBe(step.to)
      }
    }
  })

  test('a way the table does not have is refused, and nothing changes', () => {
    const words = { ...NOTE, transcript: 'done' } as const
    expect(noteStep(words, 'draft', 'uploaded')).toBeNull()
    expect(noteStep(words, 'draft', 'fast')).toBeNull() // final words never go back to fast ones
    expect(noteStep({ ...NOTE, transcript: 'none' }, 'draft', 'strong')).toBeNull()
    expect(noteStep({ ...NOTE, transcript: 'fast' }, 'draft', 'nothing')).toBeNull()
    expect(() => walk(['uploaded', 'strong', 'fast'])).toThrow('words cannot go on fast')
    expect(canGo('words', 'uploadFailed')).toBe(false)
    expect(canGo('created', 'sentFastWords')).toBe(false)
    expect(canGo('notSent', 'organizing')).toBe(false)
  })

  test('the normal way: transcribing, fast words, the strong words with a toast', () => {
    const { f, toasts } = walk(['uploaded', 'fast', 'strong'])
    expect(noteState(f)).toBe('words')
    expect(toasts).toEqual(['More complete transcription added'])
    expect(sayIn('fastWords', 'chip')).toEqual({ say: 'Partial · more coming', tone: 'partial' })
    expect(sayIn('words', 'chip')).toEqual({ say: 'Transcribed', tone: 'done' })
    // the strong model failed or said the same: the fast words stay, nothing said
    expect(walk(['uploaded', 'fast', 'fastKept']).toasts).toEqual([])
  })
})

describe('B725: an upload Taska refused', () => {
  test('says Upload failed in the chip and the Draft card, never that no words were heard', () => {
    const { f, toasts } = walk(['uploadRefused'])
    expect(noteState(f)).toBe('uploadFailed')
    expect(toasts).toEqual(['Recording upload failed'])
    expect(sayIn(noteState(f), 'chip')).toEqual({ say: 'Upload failed', tone: 'failed' })
    expect(sayIn(notesState([f]) as VoiceState, 'card')).toEqual({ say: 'Upload failed', tone: 'failed' })
    // its words never come: no answer moves it
    for (const on of ['strong', 'nothing', 'failed', 'fast'] as VoiceEvent[]) expect(noteStep(f, 'draft', on)).toBeNull()
  })

  test('sent before it was up, the message goes without it and says so', () => {
    expect(noteStep({ ...NOTE, ...NOTE_STOPPED }, 'sent', 'uploadRefused')).toEqual({ change: { uploading: false, failed: true }, toast: 'Recording upload failed' })
  })
})

describe('Taska is the truth for the words', () => {
  const answer = (a: Partial<WordsAnswer>): WordsAnswer => ({ f: 'f1.webm', state: 'wait', done: false, tr: '', tr_error: '', ...a })
  test("its answer's state is the event", () => {
    expect(heardEvent(answer({}))).toBeNull()
    expect(heardEvent(answer({ done: true, more: true, tr: 'Keep the sort' }))).toBe('fast')
    expect(heardEvent(answer({ state: 'done', done: true, tr: 'Keep the sort.' }))).toBe('strong')
    expect(heardEvent(answer({ state: 'none', done: true }))).toBe('nothing')
    expect(heardEvent(answer({ state: 'failed', done: true, tr_error: 'Gemini HTTP 503' }))).toBe('failed')
  })
})

describe('sent with its fast words: the strong words come after', () => {
  const F = 'f6-voice_0-05.webm'
  const at = (r: Input, busy: string[] = []) => {
    const m = modelOf([item({ n: 12 })], [r], { organizer: { on: true, model: '', busy } })
    return sentState(becameOf(r, m, (s) => s))
  }
  const bare = input({ id: 'r26', text: '', files: [{ f: F, name: 'voice_0-05.webm', mime: 'audio/webm' }] })

  test('each step is a way the table has, its words always the record’s', () => {
    const steps: (VoiceState | null)[] = [
      at(shown(bare, waiting(F))),
      at(shown(bare, waiting(F, 'Keep the filter and, um, the sort'))),
      at(shown(bare, record(F, 'Keep the filter, and the sort as well.')), ['r26']),
      at(shown({ ...bare, acked: true, touched: [12], org: { ok: true, msg: 'Noted on F012', t: '', keep: false, changed: true, undone: false } }, record(F, 'Keep the filter, and the sort as well.'))),
    ]
    expect(steps).toEqual(['sentTranscribing', 'sentFastWords', 'organizing', 'added'])
    expect(canGo('sending', 'sentFastWords')).toBe(true)
    for (let i = 1; i < steps.length; i++) expect(canGo(steps[i - 1], steps[i] as VoiceState), `${steps[i - 1]} -> ${steps[i]}`).toBe(true)
  })

  test('where it shows while its words come, and that they swap in silently', () => {
    expect(sayIn('sentFastWords', 'row')?.say).toBe('Transcribing…')
    expect(sayIn('sentFastWords', 'line')?.say).toBe('Sent · transcribing…')
    expect(sayIn('sentFastWords', 'talk')?.say).toBe('transcribing')
    expect(noteStep({ ...NOTE, transcript: 'fast' }, 'sent', 'strong')).toEqual({ change: { transcript: 'done' } })
    // sent before any words: nobody heard says so once
    expect(noteStep({ ...NOTE, transcript: 'wait' }, 'sent', 'nothing')?.toast).toBe('No words heard. Audio sent as is')
  })
})

test('docs/voice.md shows the diagram and the table made from this model', () => {
  const doc = readFileSync(join(__dirname, '..', '..', '..', 'docs', 'voice.md'), 'utf8')
  const diagram = '```mermaid\n' + voiceDiagram() + '\n```'
  const table = voicePlacesTable()
  expect(doc.includes(diagram), `docs/voice.md: its diagram should be\n${diagram}`).toBe(true)
  expect(doc.includes(table), `docs/voice.md: its table should be\n${table}`).toBe(true)
})
