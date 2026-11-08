// What you sent on its way (T728 #2): every phase has a rule for every place, nothing goes a way the table does not
// have, the places that disagreed now say and offer the same, a voice message on its way is in the voice state the
// phase names, and docs/inputs.md is made from the table.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { outgoingFacts, type Outgoing } from './outgoing'
import {
  OUT_PHASES,
  OUT_PHASE_LIST,
  OUT_PLACES,
  OUT_STEPS,
  outPhase,
  outStep,
  outgoingDiagram,
  outgoingIn,
  outgoingPlacesTable,
  showsOnItsWay,
  type OutPhase,
  type OutPlace,
} from './outgoingStates'
import { VOICE_STATES, VOICE_STATE_LIST } from './voiceStates'
import { AWAY } from './reach'

const out = (o: Partial<Outgoing> = {}): Outgoing => ({ q: 'q1', slug: 'demo', text: 'Keep the filter', scope: null, files: [], t: 1, state: 'waiting', tries: 0, ...o })
const PLACES = Object.keys(OUT_PLACES) as OutPlace[]
/** one of each phase, as the outbox keeps it */
const OF: Record<OutPhase, [Outgoing, number]> = {
  uploading: [out({ files: [{ f: '', name: 'a.png', uploading: true }] }), 0],
  sending: [out({ state: 'sending' }), 0],
  waiting: [out({ state: 'failed', net: true }), 0],
  notSent: [out({ state: 'failed' }), 0],
  reloaded: [out({ back: true, files: [{ f: '', name: 'a.webm', mime: 'audio/webm', uploading: true }] }), 0],
  takenBack: [out({ state: 'sending', unsent: true }), 0],
}

describe('the phases', () => {
  test('every phase has a rule for every place', () => {
    for (const p of OUT_PHASE_LIST) for (const place of PLACES) expect(OUT_PHASES[p].show, `${p} in ${place}`).toHaveProperty(place)
  })

  test('every phase is worked out from what the outbox keeps', () => {
    for (const p of OUT_PHASE_LIST) expect(outPhase(...OF[p])).toBe(p)
    // the page sure that Taska is out of reach: what goes out (or is to) waits for it
    expect(outPhase(out(), AWAY)).toBe('waiting')
    expect(outPhase(out({ state: 'sending' }), AWAY)).toBe('waiting')
    expect(outPhase(out({ state: 'failed' }), AWAY)).toBe('notSent')
  })

  test('every phase can be reached from Send or a reload, and every shown one can end', () => {
    const reached = new Set<OutPhase>()
    for (let more = true; more; ) {
      more = false
      for (const s of OUT_STEPS)
        if (s.to && (s.from === null || reached.has(s.from)) && !reached.has(s.to)) {
          reached.add(s.to)
          more = true
        }
    }
    expect([...reached].sort()).toEqual([...OUT_PHASE_LIST].sort())
    for (const p of OUT_PHASE_LIST) if (OUT_PHASES[p].show.row) expect(OUT_STEPS.some((s) => s.from === p && s.to === null), p).toBe(true)
  })

  test('every act a place offers is a way the table has from that phase', () => {
    const ON = { retry: 'retry', edit: 'edit', cancel: 'cancel' } as const
    for (const p of OUT_PHASE_LIST)
      for (const place of PLACES) for (const a of OUT_PHASES[p].show[place] ?? []) expect(OUT_STEPS.some((s) => s.from === p && s.on === ON[a]), `${a} in ${p}`).toBe(true)
  })

  test('a voice message on its way is in the voice state its phase names, and each of those says it is on its way', () => {
    const going = VOICE_STATE_LIST.filter((s) => VOICE_STATES[s].phase === 'going')
    const named = new Set(OUT_PHASE_LIST.filter((p) => OUT_PHASES[p].show.row).map((p) => OUT_PHASES[p].voice))
    expect([...named].sort()).toEqual([...going].sort())
    for (const s of going) expect(VOICE_STATES[s].show.row).toBe('going')
  })
})

describe('the ways it can go', () => {
  test('the sender: out, out of reach, again, refused, Retry, in', () => {
    let o = out()
    const go = (on: Parameters<typeof outStep>[1], away = 0) => {
      const c = outStep(o, on, away)
      if (!c || c === 'remove') throw new Error(`${outPhase(o, away)} cannot go on ${on}`)
      o = { ...o, ...c }
      return outPhase(o, 0)
    }
    expect(go('go')).toBe('sending')
    expect(go('unreachable')).toBe('waiting')
    expect(o.tries).toBe(1)
    expect(go('again')).toBe('sending')
    expect(go('go')).toBe('sending')
    expect(go('refused')).toBe('notSent')
    expect(go('retry')).toBe('sending')
    expect(outStep({ ...o, state: 'sending' }, 'taken')).toBe('remove')
  })

  test('a way the table does not have is refused', () => {
    expect(outStep(out(), 'retry')).toBeNull() // only Taska's no is sent again by Retry
    expect(outStep(out({ state: 'failed', net: true }), 'retry')).toBeNull() // it goes again by itself (T424)
    expect(outStep(out({ state: 'failed', net: true }), 'refused')).toBeNull()
    expect(outStep(out({ state: 'sending' }), 'edit')).toBeNull() // going out, Taska answering: × only
    expect(outStep(OF.reloaded[0], 'edit')).toBeNull()
    expect(outStep(OF.takenBack[0], 'edit')).toBeNull()
    expect(outStep(out({ state: 'failed' }), 'go')).toBeNull()
  })

  test('Edit and × take it back: at once when it waits, once Taska has it when it is going out', () => {
    expect(outStep(out({ state: 'failed', net: true }), 'edit')).toBe('remove')
    expect(outStep(out({ state: 'failed' }), 'edit')).toBe('remove')
    // going out while Taska seems out of reach: it may get there, so it is deleted there once Taska answers (B666)
    expect(outStep(out({ state: 'sending' }), 'edit', AWAY)).toEqual({ unsent: true })
    expect(outStep(out({ state: 'sending' }), 'cancel')).toEqual({ unsent: true })
    expect(outStep(out(), 'cancel')).toBe('remove')
  })

  test('T728: taken back while going out and refused, it goes (it no longer stops the ones after it, unseen)', () => {
    expect(outStep(out({ state: 'sending', unsent: true }), 'refused')).toBe('remove')
    expect(outStep(out({ state: 'sending', unsent: true }), 'unreachable')).toEqual({ state: 'failed', net: true, tries: 1 })
  })
})

describe('T728: every place says and offers the same', () => {
  const LISTS = PLACES.filter((p) => p !== 'card')
  test('an answer on its question’s card: the same words, nothing to do there', () => {
    expect(outgoingIn(out({ state: 'failed', net: true }), 0, 'card')).toEqual({ say: 'Waiting for Taska…', tone: 'partial', acts: [] })
    expect(outgoingIn(out({ state: 'failed' }), 0, 'card')).toEqual({ say: 'Not sent', tone: 'failed', acts: [] })
  })
  const said = (o: Outgoing, away: number, place: OutPlace) => {
    const s = outgoingIn(o, away, place)
    return s && `${s.say} (${s.tone}) ${s.acts.join(' ')}`
  }
  test('waiting for Taska: amber, Edit and ×, in the talk too', () => {
    for (const place of LISTS) expect(said(out({ state: 'failed', net: true }), 0, place)).toBe('Waiting for Taska… (partial) edit cancel')
    for (const place of LISTS) expect(said(out(), AWAY, place)).toBe('Waiting for Taska… (partial) edit cancel')
  })
  test('not sent: red, Retry, Edit and ×, everywhere', () => {
    for (const place of LISTS) expect(said(out({ state: 'failed' }), 0, place)).toBe('Not sent (failed) retry edit cancel')
  })
  test('going out: blue, × only', () => {
    for (const place of LISTS) expect(said(out(), 0, place)).toBe('Sending… (busy) cancel')
    for (const place of LISTS) expect(said(...OF.uploading, place)).toBe('Uploading… (busy) cancel')
  })
  test('taken back, or sent before a reload with its files going up: nowhere', () => {
    for (const p of ['takenBack', 'reloaded'] as const) {
      for (const place of PLACES) expect(outgoingIn(...OF[p], place)).toBeNull()
      expect(showsOnItsWay(OF[p][0])).toBe(false)
      expect(outgoingFacts(OF[p][0], 0, 'inputs')).toBeNull()
    }
  })
})

test('docs/inputs.md shows the diagram and the table made from this model', () => {
  const doc = readFileSync(join(__dirname, '..', '..', '..', 'docs', 'inputs.md'), 'utf8')
  const diagram = '```mermaid\n' + outgoingDiagram() + '\n```'
  const table = outgoingPlacesTable()
  expect(doc.includes(diagram), `docs/inputs.md: its diagram should be\n${diagram}`).toBe(true)
  expect(doc.includes(table), `docs/inputs.md: its table should be\n${table}`).toBe(true)
})
