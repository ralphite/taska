// What became of an input (T728 #1): every state has a rule for every place, nothing goes a way the table does not
// have, every act a place offers is a way it can go, the places that disagreed now say and offer the same, a voice
// message is in the voice state its input's names, and docs/inputs.md is made from the table.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { input, item, modelOf, waiting } from '../stories/fixtures'
import { feedbackLine } from './boxFoot'
import { becameOf, type Became } from './became'
import {
  ACT_EVENT,
  INPUT_PLACES,
  INPUT_STATES,
  INPUT_STATE_LIST,
  INPUT_STEPS,
  actsIn,
  becameText,
  canGo,
  inputDiagram,
  inputPlacesTable,
  reached,
  showsIn,
  voiceStateOf,
  type InputPlace,
  type InputState,
} from './inputStates'
import type { Input, OrgNote } from './types'
import { VOICE_STATES } from './voiceStates'

const PLACES = Object.keys(INPUT_PLACES) as InputPlace[]
const org = (msg: string, f: Partial<OrgNote> = {}): OrgNote => ({ ok: true, msg, t: '', keep: false, changed: true, undone: false, ...f })
const m = (on = true, busy: string[] = []) => modelOf([item({ n: 14, type: 'bug' }), item({ n: 12 })], [], { organizer: { on, model: '', busy } })
const of = (f: Partial<Input> & { id: string }, mm = m()) => becameOf(input(f), mm, (s) => (s === 'mobile-app' ? 'Mobile app' : s))
const FILING = { can: true, what: 'removes B014', why: '' }

describe('the states', () => {
  test('every state has a rule for every place', () => {
    for (const s of INPUT_STATE_LIST) for (const p of PLACES) expect(INPUT_STATES[s].show, `${s} in ${p}`).toHaveProperty(p)
  })

  test('every state can be reached once Taska has it, and every way joins two states', () => {
    const got = new Set<InputState>()
    for (let more = true; more; ) {
      more = false
      for (const s of INPUT_STEPS)
        if ((s.from === null || got.has(s.from)) && !got.has(s.to)) {
          got.add(s.to)
          more = true
        }
    }
    expect([...got].sort()).toEqual([...INPUT_STATE_LIST].sort())
  })

  test('every act a place offers is a way the table has from that state', () => {
    for (const s of INPUT_STATE_LIST)
      for (const p of PLACES)
        for (const a of INPUT_STATES[s].show[p] ?? []) {
          const on = ACT_EVENT[a]
          if (on) expect(INPUT_STEPS.some((x) => x.from === s && x.on === on), `${a} in ${s} (${p})`).toBe(true)
        }
  })

  test('a way the table does not have is refused', () => {
    expect(canGo('failed', 'undone')).toBe(false) // a failed one has no filing to undo
    expect(canGo('agent', 'undone')).toBe(false)
    expect(canGo('organizing', 'undone')).toBe(false)
    expect(canGo('moved', 'organizing')).toBe(false)
    expect(canGo('handled', 'failed')).toBe(false)
    expect(canGo(null, 'filed')).toBe(false) // the organizer reads it first
  })

  test('every state is one becameOf works out, and its words are one wording in every place', () => {
    const seen: Partial<Record<InputState, Became>> = {
      transcribing: of({ id: 'r1', files: [{ f: 'f1.webm', name: 'v.webm', mime: 'audio/webm', voice: waiting('f1.webm') }] }),
      organizing: of({ id: 'r1' }),
      filed: of({ id: 'r1', acked: true, touched: [14], org: org('Created B014') }),
      answer: of({ id: 'r1', acked: true, kind: 'answer', scope: 12 }),
      agent: of({ id: 'r1', org: org('Left for agent', { keep: true }) }),
      note: of({ id: 'r1', acked: true, org: org('Nothing to file: a thank-you') }),
      handled: of({ id: 'r1', acked: true }),
      failed: of({ id: 'r1', org: org('Gemini HTTP 401: API key not valid', { ok: false }) }),
      undone: of({ id: 'r1', org: org('Undone', { undone: true }) }),
      cancelled: of({ id: 'r1', kind: 'cancelled' }),
      moved: of({ id: 'r1', moved: { to: 'mobile-app', as: 'r4' } }),
    }
    for (const s of INPUT_STATE_LIST) expect(seen[s]?.k, s).toBe(s)
    for (const s of INPUT_STATE_LIST) {
      const b = seen[s] as Became
      const words = new Set(PLACES.filter((p) => p !== 'sheet' && p !== 'talk' && showsIn(b, p) && b.k !== 'transcribing').map((p) => becameText(b, p)))
      expect(words.size, `${s}: ${[...words].join(' | ')}`).toBeLessThanOrEqual(1)
    }
  })
})

describe('a voice message: its state is the one its input names', () => {
  test('where the voice table shows what became of it, the input table shows it too', () => {
    for (const s of INPUT_STATE_LIST) {
      const v = INPUT_STATES[s].voice
      if (!v || s === 'transcribing') continue
      for (const p of ['row', 'line'] as const) expect(VOICE_STATES[v].show[p] === 'became', `${s} (${v}) in ${p}`).toBe(INPUT_STATES[s].show[p] !== null)
    }
  })
  test('one that made an item is Created; its words to come are as Taska has them', () => {
    expect(voiceStateOf(of({ id: 'r1', acked: true, touched: [14], org: org('Created B014') }))).toBe('created')
    expect(voiceStateOf(of({ id: 'r1', acked: true, touched: [12], org: org('Noted on F012') }))).toBe('added')
    expect(voiceStateOf({ k: 'transcribing', state: 'sentFastWords' })).toBe('sentFastWords')
    expect(voiceStateOf({ k: 'undone', retry: true })).toBeNull()
  })
})

describe('T728: the line over the box says and offers what the lists do', () => {
  const line = (r: Input, mm = m(), others = false) => {
    const x = feedbackLine({ m: { ...mm, byId: new Map([[r.id, r]]) }, desk: false, scope: null, mine: [], away: 0, lastSent: r.id, others, title: (s) => s })
    return x?.line.kind === 'became' ? { text: x.line.text, acts: x.line.acts, final: !!x.final } : null
  }
  test('one word per state: Organizing…, Handled, For an agent, Undone (not "Sent · organizing…", "Seen, no item made")', () => {
    expect(line(input({ id: 'r1' }))?.text).toBe('Organizing…')
    expect(line(input({ id: 'r1', acked: true }), m(false))?.text).toBe('Handled')
    expect(line(input({ id: 'r1', org: org('Left for agent', { keep: true }) }))?.text).toBe('For an agent')
    expect(line(input({ id: 'r1' }), m(false))?.text).toBe('For an agent')
    expect(line(input({ id: 'r1', org: org('Undone', { undone: true }) }))).toEqual({ text: 'Undone', acts: ['organize'], final: true })
    // the organizer's own words for what it did, as the lists say them
    expect(line(input({ id: 'r1', acked: true, touched: [14, 12], org: org('Created B014 · noted on F012') }))?.text).toBe('Created B014 · Added to F012')
  })
  test('Undo only where Taska would take the filing back (it was offered without its filing)', () => {
    const filed = { id: 'r1', acked: true, touched: [14], org: org('Created B014') }
    expect(line(input(filed))?.acts).toEqual(['open'])
    expect(line(input({ ...filed, filing: FILING }))?.acts).toEqual(['open', 'undo'])
    expect(line(input({ ...filed, filing: { ...FILING, can: false, why: 'B014 changed since' } }))?.acts).toEqual(['open'])
  })
  test('Retry only where it can help: the organizer on, and not asking again by itself', () => {
    const failed = (f: Partial<OrgNote> = {}) => input({ id: 'r1', org: org('Gemini HTTP 401: API key not valid', { ok: false, ...f }) })
    expect(line(failed())?.acts).toEqual(['retry'])
    expect(line(failed(), m(false))?.acts).toEqual([])
    // its service only busy: Taska asks again by itself (T424), it is organizing
    expect(line(failed({ msg: 'Gemini HTTP 503: overloaded', again: true }))?.text).toBe('Organizing…')
  })
  test('a recording kept as cancelled shows nothing there; Move only with another project', () => {
    expect(line(input({ id: 'r1', kind: 'cancelled' }))).toBeNull()
    expect(line(input({ id: 'r1', acked: true }), m(), true)?.acts).toEqual(['move'])
  })
})

describe('T728: the menu, as the lists', () => {
  const sheet = (b: Became, others = true) => actsIn(b, 'sheet', { others })
  test('Undo as the server allows it; no Move while Taska works on it', () => {
    expect(sheet(of({ id: 'r1', acked: true, touched: [14], org: org('Created B014'), filing: FILING }))).toEqual(['undo', 'move'])
    expect(sheet(of({ id: 'r1' }))).toEqual([])
    expect(sheet(of({ id: 'r1' }, m(true, ['r1'])))).toEqual([])
    expect(sheet(of({ id: 'r1', kind: 'cancelled' }))).toEqual(['send', 'move'])
  })
  test('the organizer or an agent had it: taking it back quietly is too late', () => {
    expect(reached(input({ id: 'r1' }), { busy: [] })).toBe(false)
    expect(reached(input({ id: 'r1' }), { busy: ['r1'] })).toBe(true)
    expect(reached(input({ id: 'r1', org: org('Left', { keep: true }) }), { busy: [] })).toBe(true)
  })
})

test('docs/inputs.md shows the diagram and the table made from this model', () => {
  const doc = readFileSync(join(__dirname, '..', '..', '..', 'docs', 'inputs.md'), 'utf8')
  const diagram = '```mermaid\n' + inputDiagram() + '\n```'
  const table = inputPlacesTable()
  expect(doc.includes(diagram), `docs/inputs.md: its diagram should be\n${diagram}`).toBe(true)
  expect(doc.includes(table), `docs/inputs.md: its table should be\n${table}`).toBe(true)
})
