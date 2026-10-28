// What the foot of the project page says: what the box writes to, and the line about what you sent last.

import { describe, expect, it as test } from 'vitest'
import { doc } from '../stories/docFixtures'
import { input, item, modelOf } from '../stories/fixtures'
import { boxRole, feedbackLine, shownBox } from './boxFoot'
import type { TickState } from './docTicks'
import type { Outgoing } from './outgoing'
import { codeOf } from './project'
import { NO_FILTERS, type Route } from './route'

type Place = Extract<Route, { page: 'project' }>
const at = (place: Place['place']): Place => ({ page: 'project', slug: 'taska', tab: 'items', place, list: NO_FILTERS })
const m = modelOf([item({ n: 12 })], [input({ id: 'r7', text: 'Keep the filter' })], {}, [doc()])
const nothing = { sel: new Set<string>(), quote: null, reply: null }
const noTicks: TickState = { mine: {}, going: {}, open: new Set() }
const code = codeOf(m, 12)

describe('what the box writes to', () => {
  test('a new input: the desktop says so; the phone says nothing', () => {
    const desk = boxRole(m, at({ kind: 'tab' }), true, 'taska', null, nothing, noTicks)
    expect([desk.scope, desk.line?.label, desk.placeholder, desk.send]).toEqual([null, 'New input', 'Write to taska…', 'Send'])
    expect(boxRole(m, at({ kind: 'tab' }), false, 'taska', null, nothing, noTicks).line).toBeNull()
  })

  test('an item open: a reply on it', () => {
    const r = boxRole(m, at({ kind: 'item', ref: code }), true, 'taska', null, nothing, noTicks)
    expect([r.scope, r.line, r.placeholder]).toEqual([code, null, `Reply to ${code}…`])
  })

  test('a paragraph picked in a document: a comment on it, with an x that lets go', () => {
    const r = boxRole(m, at({ kind: 'doc', d: 12 }), true, 'taska', null, { ...nothing, sel: new Set(['p1']) }, noTicks)
    expect(r.aim?.target.key).toBe('p1')
    expect([r.doc, r.line?.label, r.line?.right, r.send]).toEqual([12, 'Comment on D12', { kind: 'x', label: 'Cancel the comment', act: 'unpick' }, 'Comment'])
  })

  test('the phone’s document, nothing picked: the whole document, or a reply to its item instead', () => {
    const r = boxRole(m, at({ kind: 'doc', d: 12 }), false, 'taska', null, nothing, noTicks)
    expect([r.aim?.target.key, r.line?.detail, r.line?.right]).toEqual(['doc', '· or tap a part', { kind: 'to-item', code }])
  })

  test('the preferences, an edit of what you said: their line, Save, and Stop', () => {
    const prefs = boxRole(m, at({ kind: 'tab' }), true, 'taska', { kind: 'prefs', was: '' }, nothing, noTicks)
    expect([prefs.line?.label, prefs.line?.right, prefs.send]).toEqual(['Edit transcription preferences', { kind: 'x', label: 'Stop editing', act: 'stop' }, 'Save'])
    const amend = boxRole(m, at({ kind: 'tab' }), true, 'taska', { kind: 'amend', id: 'r7', mode: 'append', v: 1 }, nothing, noTicks)
    expect([amend.line?.label, amend.line?.detail, amend.line?.right]).toEqual(['Add details to #7', '“Keep the filter”', { kind: 'x', label: 'Stop adding details', act: 'stop' }])
  })

  test('with what it holds: a correction says before and after; a recording for another draft says where it goes', () => {
    const role = boxRole(m, at({ kind: 'tab' }), true, 'taska', { kind: 'correct', id: 'r7', wrong: 'filtre', v: 1 }, nothing, noTicks)
    expect(shownBox(role, { mode: { kind: 'correct', id: 'r7', wrong: 'filtre', v: 1 }, text: 'filter', key: 'correct r7', recordingFor: null }).line?.label).toBe('Correct “filtre” → “filter”')
    const plain = boxRole(m, at({ kind: 'tab' }), true, 'taska', null, nothing, noTicks)
    expect(shownBox(plain, { mode: null, text: '', key: 'new', recordingFor: code }).line?.label).toBe(`Recording for ${code}`)
  })
})

describe('the line over the box', () => {
  const out = (o: Partial<Outgoing>): Outgoing => ({ q: 'q1', slug: 'taska', text: 'Keep the filter', scope: null, files: [], t: 1, state: 'sending', tries: 0, ...o })
  const base = { m, desk: false, composePage: false, scope: null, mine: [] as Outgoing[], lastSent: null, others: false, undoable: () => true }

  test('on its way, or not sent', () => {
    expect(feedbackLine({ ...base, mine: [out({})] })?.line).toEqual({ kind: 'sending', text: 'Keep the filter', more: 0, uploading: false, canUndo: true })
    expect(feedbackLine({ ...base, mine: [out({ state: 'failed' })] })?.line.kind).toBe('not-sent')
    expect(feedbackLine({ ...base, mine: [out({ state: 'failed', net: true })] })?.line.kind).toBe('waiting')
  })

  test('none on the New input page, nor in an item', () => {
    expect(feedbackLine({ ...base, desk: true, composePage: true, mine: [out({})] })).toBeNull()
    expect(feedbackLine({ ...base, scope: code, mine: [out({})] })).toBeNull()
  })
})
