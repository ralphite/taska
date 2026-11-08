// What the foot of the project page says: what the box writes to, and the line about what you sent last.

import { describe, expect, it as test } from 'vitest'
import { doc } from '../stories/docFixtures'
import { input, item, modelOf } from '../stories/fixtures'
import { boxRole, boxShowsRecording, feedbackLine, shownBox } from './boxFoot'
import type { TickState } from './docTicks'
import type { Outgoing } from './outgoing'
import { draftKey } from './draftTarget'
import { codeOf } from './project'
import { NO_FILTERS, type Route } from './route'

type Place = Extract<Route, { page: 'project' }>
const at = (place: Place['place']): Place => ({ page: 'project', slug: 'taska', tab: 'items', place, list: NO_FILTERS })
const m = modelOf([item({ n: 12 })], [input({ id: 'r7', text: 'Keep the filter' })], {}, [doc()])
const nothing = { sel: new Set<string>(), quote: null, reply: null }
const noTicks: TickState = { mine: {}, going: {}, open: new Set() }
const code = codeOf(m, 12)

describe('what the box writes to', () => {
  // Yadong (r583, r1092): no line over the box for a new input; change only on his explicit word
  test('a new input: no line over the box, on the desktop or the phone', () => {
    const desk = boxRole(m, at({ kind: 'tab' }), true, 'taska', null, nothing, noTicks)
    expect([desk.scope, desk.line, desk.placeholder, desk.send]).toEqual([null, null, 'Write to taska…', 'Send'])
    expect(boxRole(m, at({ kind: 'tab' }), false, 'taska', null, nothing, noTicks).line).toBeNull()
  })

  // Yadong (F706, r1146): on the rules, the box comments on them; change only on his explicit word
  test('the rules open, nothing picked: a comment on the rules, desktop and phone', () => {
    const rules = { ...doc(), d: 9, n: 0, kind: 'rules' as const }
    const rm = modelOf([item({ n: 12 })], [], {}, [rules])
    const rulesAt: Place = { page: 'project', slug: 'taska', tab: 'rules', place: { kind: 'tab' }, list: NO_FILTERS }
    for (const desk of [true, false]) {
      const r = boxRole(rm, rulesAt, desk, 'taska', null, nothing, noTicks)
      expect([r.aim, r.scope, r.line, r.placeholder, r.send]).toEqual([{ d: 9, target: { key: 'doc', quote: '' } }, null, null, 'Comment on the rules…', 'Comment'])
    }
  })

  test('an item open: a reply on it', () => {
    const r = boxRole(m, at({ kind: 'item', ref: code }), true, 'taska', null, nothing, noTicks)
    expect([r.scope, r.line, r.placeholder]).toEqual([code, null, `Reply to ${code}…`])
  })

  test('a paragraph picked in a document: a comment on it, with an x that lets go', () => {
    const r = boxRole(m, at({ kind: 'doc', d: 12 }), true, 'taska', null, { ...nothing, sel: new Set(['p1']) }, noTicks)
    expect(r.aim?.target.key).toBe('p1')
    expect([r.doc, r.line?.label, r.line?.right, r.send]).toEqual([12, 'Comment on D12', { kind: 'x', label: 'Cancel · Esc', act: 'unpick' }, 'Comment'])
  })

  test("the phone's document, nothing picked: the whole document, or a reply to its item instead", () => {
    const r = boxRole(m, at({ kind: 'doc', d: 12 }), false, 'taska', null, nothing, noTicks)
    expect([r.aim?.target.key, r.line?.detail, r.line?.right]).toEqual(['doc', '· or tap a part', { kind: 'to-item', code }])
  })

  // r1095: the desktop's document bar has Comment, for a comment on the whole document
  test("the desktop's document, its Comment pressed: a comment on the whole of it, with an x that lets go", () => {
    const r = boxRole(m, at({ kind: 'doc', d: 12 }), true, 'taska', null, { ...nothing, quote: { key: 'doc', text: '' } }, noTicks)
    expect([r.aim?.target.key, r.line?.label, r.line?.detail, r.line?.right, r.send]).toEqual(['doc', 'Comment on D12', '', { kind: 'x', label: 'Cancel · Esc', act: 'unpick' }, 'Comment'])
  })

  test('the preferences, an edit of what you said: their line, Save, and Stop', () => {
    const prefs = boxRole(m, at({ kind: 'tab' }), true, 'taska', { kind: 'prefs', was: '' }, nothing, noTicks)
    expect([prefs.line?.label, prefs.line?.right, prefs.send]).toEqual(['Edit transcription preferences', { kind: 'x', label: 'Stop editing', act: 'stop' }, 'Save'])
    const amend = boxRole(m, at({ kind: 'tab' }), true, 'taska', { kind: 'amend', id: 'r7', mode: 'append', v: 1 }, nothing, noTicks)
    expect([amend.line?.label, amend.line?.detail, amend.line?.right]).toEqual(['Add to #7', '“Keep the filter”', { kind: 'x', label: 'Stop adding', act: 'stop' }])
  })

  test('with what it holds: a correction says the word (what it becomes is in the box); a recording for another draft says where it goes', () => {
    const role = boxRole(m, at({ kind: 'tab' }), true, 'taska', { kind: 'correct', id: 'r7', wrong: 'filtre', v: 1 }, nothing, noTicks)
    expect(shownBox(role, { mode: { kind: 'correct', id: 'r7', wrong: 'filtre', v: 1 }, text: 'filter', key: 'correct r7', recordingFor: null }).line?.label).toBe('Correct “filtre”')
    const plain = boxRole(m, at({ kind: 'tab' }), true, 'taska', null, nothing, noTicks)
    expect(shownBox(plain, { mode: null, text: '', key: 'new', recordingFor: code }).line?.label).toBe(`Recording for ${code}`)
  })
})

describe('a recording in the box', () => {
  const row = draftKey({ kind: 'amend', mode: 'append', id: 'r7' })
  const list = { place: at({ kind: 'tab' }).place, list: true, key: 'new' }
  test('more said into an input from its row: its strip there says it, the box adds nothing and the list never moves (B720, B498)', () => {
    expect(boxShowsRecording({ key: row }, list)).toBe(false)
    // no list in sight (another page): the box says where it goes
    expect(boxShowsRecording({ key: row }, { ...list, list: false })).toBe(true)
    // the box's own Add to #7 recording: the box's
    expect(boxShowsRecording({ key: row }, { ...list, key: row })).toBe(true)
    expect(boxShowsRecording({ key: 'new' }, list)).toBe(true)
  })
  test('a voice comment about a place in sight: its strip there', () => {
    expect(boxShowsRecording({ key: 'new', about: { d: 1, bar: true } }, list)).toBe(false)
    expect(boxShowsRecording({ key: 'new', about: { d: 1, bar: false } }, { ...list, place: at({ kind: 'doc', d: 1 }).place })).toBe(false)
    expect(boxShowsRecording({ key: 'new', about: { d: 1, bar: false } }, list)).toBe(true)
  })
})

describe('the line over the box', () => {
  const out = (o: Partial<Outgoing>): Outgoing => ({ q: 'q1', slug: 'taska', text: 'Keep the filter', scope: null, files: [], t: 1, state: 'sending', tries: 0, ...o })
  const base = { m, desk: false, scope: null, mine: [] as Outgoing[], away: 0, lastSent: null, others: false }
  const said = (f: Partial<typeof base>) => {
    const l = feedbackLine({ ...base, ...f })?.line
    return l?.kind === 'going' ? `${l.show.say} ${l.show.acts.join(' ')}` : l?.kind
  }

  test('on its way, or not sent: the words and acts of model/outgoingStates', () => {
    expect(feedbackLine({ ...base, mine: [out({})] })?.line).toEqual({ kind: 'going', q: 'q1', text: 'Keep the filter', more: 0, show: { say: 'Sending…', tone: 'busy', acts: ['cancel'] } })
    expect(said({ mine: [out({ state: 'failed' })] })).toBe('Not sent retry edit cancel')
    expect(said({ mine: [out({ state: 'failed', net: true })] })).toBe('Waiting for Taska… edit cancel')
  })

  test('T728: Taska out of reach for a while says Waiting for Taska, as the lists do (it said Sending)', () => {
    expect(said({ mine: [out({})], away: 2 })).toBe('Waiting for Taska… edit cancel')
    expect(said({ mine: [out({})], away: 1 })).toBe('Sending… cancel')
  })

  test('a quiet one (an answer, a kept recording) shows only when it needs you; taken back, never', () => {
    expect(said({ mine: [out({ quiet: true })] })).toBeUndefined()
    expect(said({ mine: [out({ quiet: true, state: 'failed' })] })).toBe('Not sent retry edit cancel')
    expect(said({ mine: [out({ unsent: true }), out({ q: 'q2' })] })).toBe('Sending… cancel')
  })

  test('none on the New input page, nor in an item', () => {
    // the phone's only (T689)
    expect(feedbackLine({ ...base, desk: true, mine: [out({})] })).toBeNull()
    expect(feedbackLine({ ...base, scope: code, mine: [out({})] })).toBeNull()
  })
})
