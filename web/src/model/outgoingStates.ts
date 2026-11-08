// What you sent on its way to Taska, in one place (T728 #2): every phase an input goes through from Send until Taska
// has it, the event that moves it from each phase to the next (the only ways it can go), and what each place shows in
// each phase: its words, their tone and what can be done there. Every place that shows something on its way reads it
// here; nothing else decides those words or those buttons. The diagram and the table in docs/inputs.md are made from
// this table (`outgoingDiagram`, `outgoingPlacesTable`, checked by a test).
//
// The outbox keeps what is on its way (stores/outbox: `state`, `net`, `unsent`, `back`, its files' `uploading`), and
// the page knows how sure it is that Taska is out of reach (`away`, 2 and more: say so). The phase is worked out from
// those by `outPhase`, the one place it is; the sender changes them only by `outStep`, which refuses a way the table
// does not have. Once Taska has it, what became of it is the input's (model/inputStates). Pure.

import type { Outgoing } from './outgoing'
import type { VoiceState } from './voiceStates'

/** Where something on its way shows. */
export const OUT_PLACES = {
  row: "its row in the desktop's New input list",
  line: "the line over the phone's box (New input)",
  inputs: 'its row on the Inputs page',
  talk: "your bubble in the item's talk",
  card: "an answer, on its question's card in the item's talk",
} as const
export type OutPlace = keyof typeof OUT_PLACES

/** busy: blue, moving; partial: amber (it waits, nothing to do); failed: red */
export type OutTone = 'busy' | 'partial' | 'failed'

/** What can be done to it: send it again (Taska said no), take it back into the box to change it, cancel it (×: it is
 * not sent). */
export type OutAct = 'retry' | 'edit' | 'cancel'
export const OUT_ACT_WORD: Record<Exclude<OutAct, 'cancel'>, string> = { retry: 'Retry', edit: 'Edit' }

interface PhaseDef {
  label: string
  /** its words, the same in every place */
  say: string
  tone: OutTone
  /** a voice message on its way is in this state of model/voiceStates (null: it shows as none of them) */
  voice: VoiceState | null
  /** it needs you (it waits for Taska, or Taska said no): even a quiet one (an answer, a recording kept as cancelled)
   * shows on the line over the box */
  needsYou: boolean
  /** what each place shows: these acts beside its words (× is `cancel`); null: it does not show there */
  show: Record<OutPlace, readonly OutAct[] | null>
}

/** the same in every list; an answer's card says only where it is (its own Send answer is greyed meanwhile) */
const ALL = <T extends readonly OutAct[] | null>(acts: T) => ({ row: acts, line: acts, inputs: acts, talk: acts, card: acts && ([] as const) })

/** Every phase, the normal way first. */
export const OUT_PHASES = {
  uploading: { label: 'Uploading', say: 'Uploading…', tone: 'busy', voice: 'sending', needsYou: false, show: ALL(['cancel'] as const) },
  sending: { label: 'Sending', say: 'Sending…', tone: 'busy', voice: 'sending', needsYou: false, show: ALL(['cancel'] as const) },
  // Taska out of reach: it goes again by itself (T424: no Retry); it can be taken back to change it
  waiting: { label: 'Waiting for Taska', say: 'Waiting for Taska…', tone: 'partial', voice: 'offline', needsYou: true, show: ALL(['edit', 'cancel'] as const) },
  // Taska said no: Retry sends it again
  notSent: { label: 'Not sent', say: 'Not sent', tone: 'failed', voice: 'notSent', needsYou: true, show: ALL(['retry', 'edit', 'cancel'] as const) },
  // sent before a reload, its files going up again: it shows once they are up (it goes all the same)
  reloaded: { label: 'Sent before a reload, its files going up', say: 'Uploading…', tone: 'busy', voice: 'sending', needsYou: false, show: ALL(null) },
  // cancelled (or taken back to change) while going out: deleted as soon as Taska has it (B666)
  takenBack: { label: 'Taken back while going out', say: 'Sending…', tone: 'busy', voice: null, needsYou: false, show: ALL(null) },
} as const satisfies Record<string, PhaseDef>

export type OutPhase = keyof typeof OUT_PHASES
export const OUT_PHASE_LIST = Object.keys(OUT_PHASES) as OutPhase[]

/** What happens to something on its way, in a few words (the diagram's labels). */
export const OUT_EVENTS = {
  send: 'Send',
  reload: 'The page reloaded',
  uploaded: 'Its files up',
  go: 'Goes out',
  away: 'No answer for a while',
  reached: 'Taska answers again',
  unreachable: 'Taska out of reach',
  again: 'Tried again (by itself, sooner once Taska is back)',
  refused: 'Taska said no',
  retry: 'Retry',
  edit: 'Edit: back in the box',
  cancel: '×',
  taken: 'Taska has it',
} as const
export type OutEvent = keyof typeof OUT_EVENTS

export interface OutStep {
  /** null: where it starts (Send), or where it ends (Taska has it, or it is not sent) */
  from: OutPhase | null
  on: OutEvent
  to: OutPhase | null
}

const SHOWN = ['uploading', 'sending', 'waiting', 'notSent'] as const
const each = (from: readonly OutPhase[], on: OutEvent, to: OutPhase | null): OutStep[] => from.map((f) => ({ from: f, on, to }))

/** Every way it can go: from a phase, on an event, to a phase (null: it is gone from the outbox). Nothing else is
 * allowed. */
export const OUT_STEPS: readonly OutStep[] = [
  { from: null, on: 'send', to: 'uploading' },
  { from: null, on: 'send', to: 'sending' },
  { from: null, on: 'reload', to: 'reloaded' },
  { from: null, on: 'reload', to: 'sending' },
  { from: 'reloaded', on: 'uploaded', to: 'sending' },
  { from: 'uploading', on: 'uploaded', to: 'sending' },
  { from: 'sending', on: 'go', to: 'sending' },
  // the page's own sense that Taska is out of reach: nothing changes in the outbox
  { from: 'uploading', on: 'away', to: 'waiting' },
  { from: 'sending', on: 'away', to: 'waiting' },
  { from: 'waiting', on: 'reached', to: 'sending' },
  { from: 'sending', on: 'unreachable', to: 'waiting' },
  { from: 'waiting', on: 'again', to: 'sending' },
  { from: 'sending', on: 'refused', to: 'notSent' },
  { from: 'notSent', on: 'retry', to: 'sending' },
  ...each(['waiting', 'notSent'], 'edit', null),
  { from: 'waiting', on: 'edit', to: 'takenBack' },
  ...each(SHOWN, 'cancel', null),
  ...each(['sending', 'waiting'], 'cancel', 'takenBack'),
  { from: 'sending', on: 'taken', to: null },
  { from: 'takenBack', on: 'taken', to: null },
  { from: 'takenBack', on: 'refused', to: null },
  { from: 'takenBack', on: 'unreachable', to: 'takenBack' },
  { from: 'takenBack', on: 'again', to: 'takenBack' },
  { from: 'takenBack', on: 'go', to: 'takenBack' },
]

/** Taska is out of reach for the page: it has not answered for a while (projectSync's `away`, 2 and more). */
export const AWAY = 2

/** It is going out right now (its request not answered yet). */
export const inFlight = (o: Pick<Outgoing, 'state'>) => o.state === 'sending'

/** Its phase, from what the outbox keeps of it and how sure the page is that Taska is out of reach: the one place it
 * is worked out. */
export function outPhase(o: Pick<Outgoing, 'state' | 'net' | 'unsent' | 'back' | 'files'>, away: number): OutPhase {
  if (o.unsent) return 'takenBack'
  const uploading = o.files.some((f) => f.uploading)
  if (o.back && uploading) return 'reloaded'
  if (o.state === 'failed') return o.net ? 'waiting' : 'notSent'
  if (away >= AWAY) return 'waiting'
  return uploading ? 'uploading' : 'sending'
}

/** What a place shows of it: its words and their tone, and what can be done there; null: it does not show there. */
export interface OutShow {
  say: string
  tone: OutTone
  acts: readonly OutAct[]
}

/** What `place` shows in phase `p`. */
export function phaseIn(p: OutPhase, place: OutPlace): OutShow | null {
  const def = OUT_PHASES[p]
  const acts = def.show[place]
  return acts ? { say: def.say, tone: def.tone, acts } : null
}

/** What `place` shows of `o` (`away`: how sure the page is that Taska is out of reach). */
export function outgoingIn(o: Pick<Outgoing, 'state' | 'net' | 'unsent' | 'back' | 'files' | 'quiet'>, away: number, place: OutPlace): OutShow | null {
  const p = outPhase(o, away)
  if (place === 'line' && o.quiet && !OUT_PHASES[p].needsYou) return null
  return phaseIn(p, place)
}

/** Whether it shows as on its way anywhere. */
export const showsOnItsWay = (o: Pick<Outgoing, 'state' | 'net' | 'unsent' | 'back' | 'files'>) => OUT_PHASES[outPhase(o, 0)].show.row !== null

/** What each event changes in the outbox ('remove': it goes from it); the events of the page's own sense of Taska
 * (away, reached) and of its files (uploaded) change nothing here. */
const CHANGES: Partial<Record<OutEvent, (o: Outgoing) => Partial<Outgoing> | 'remove'>> = {
  go: () => ({ state: 'sending' }),
  unreachable: (o) => ({ state: 'failed', net: true, tries: o.tries + 1 }),
  refused: (o) => (o.unsent ? 'remove' : { state: 'failed', net: false, tries: o.tries + 1 }),
  again: () => ({ state: 'waiting', net: false }),
  retry: () => ({ state: 'waiting', net: false }),
  // going out right now: Taska may have it already, so it is deleted there once it answers (B666)
  edit: (o) => (inFlight(o) ? { unsent: true } : 'remove'),
  cancel: (o) => (inFlight(o) ? { unsent: true } : 'remove'),
  taken: () => 'remove',
}

/** `o` moved on by `on` (`away`: how sure the page is that Taska is out of reach, as where it was done shows it): what
 * changes of it in the outbox ('remove': it goes), or null when it cannot go that way from where it is (then nothing
 * changes). The one way the sender and the box change what is on its way. */
export function outStep(o: Outgoing, on: OutEvent, away = 0): Partial<Outgoing> | 'remove' | null {
  const from = outPhase(o, away)
  const ok = OUT_STEPS.some((s) => s.on === on && s.from === from)
  const change = CHANGES[on]
  if (!ok || !change) return null
  return change(o)
}

// ---------------------------------------------------------------- the diagram and the table (docs/inputs.md)

/** The phases and every way between them as a Mermaid flowchart (the events that go the same way are one arrow). */
export function outgoingDiagram(): string {
  const lines = ['flowchart TD', '    start(("Send"))', '    gone(("gone"))']
  for (const s of OUT_PHASE_LIST) lines.push(`    ${s}["${OUT_PHASES[s].label}"]`)
  const ways = new Map<string, OutEvent[]>()
  for (const s of OUT_STEPS) {
    const key = `${s.from ?? 'start'} ${s.to ?? 'gone'}`
    const on = ways.get(key) ?? []
    if (!on.includes(s.on)) on.push(s.on)
    ways.set(key, on)
  }
  for (const [key, on] of ways) {
    const [from, to] = key.split(' ')
    lines.push(`    ${from} -->|"${on.map((e) => OUT_EVENTS[e]).join(' · ')}"| ${to}`)
  }
  return lines.join('\n')
}

const ACT_CELL: Record<OutAct, string> = { retry: 'Retry', edit: 'Edit', cancel: '×' }

/** What each place shows in each phase, as a Markdown table; —: nothing. */
export function outgoingPlacesTable(): string {
  const places = Object.keys(OUT_PLACES) as OutPlace[]
  const cell = (p: OutPhase, place: OutPlace) => {
    const acts = OUT_PHASES[p].show[place]
    return acts ? `${OUT_PHASES[p].say} (${OUT_PHASES[p].tone})${acts.length ? ' · ' + acts.map((a) => ACT_CELL[a]).join(' ') : ''}` : '—'
  }
  return [
    `| Phase | ${places.map((p) => OUT_PLACES[p]).join(' | ')} |`,
    `|---|${places.map(() => '---').join('|')}|`,
    ...OUT_PHASE_LIST.map((s) => `| ${OUT_PHASES[s].label} (\`${s}\`) | ${places.map((p) => cell(s, p)).join(' | ')} |`),
  ].join('\n')
}
