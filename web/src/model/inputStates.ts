// What became of an input, in one place (T728 #1): every state an input is in once Taska has it, from its words being
// worked out and the organizer reading it to what it made, the event that moves it from each state to the next (the
// only ways it can go), and what each place shows in each state: its words, their tone and what can be done there.
// Every place that says what became of an input reads it here; nothing else decides those words or those buttons. The
// diagram and the table in docs/inputs.md are made from this table (`inputDiagram`, `inputPlacesTable`, checked by a
// test).
//
// The state, with what it names (the items, why it failed, where it went), is worked out from the input Taska sent
// and the organizer's facts by model/became `becameOf`, the one place it is; Taska's side of the same way is
// server/taska/domain/input_states.py (a failure its `transient` rule says goes away is never written). Before Taska
// has it, it is on its
// way (model/outgoingStates). Pure.

import type { Became } from './became'
import type { Input } from './types'
import { sayIn, type VoicePlace, type VoiceState } from './voiceStates'

/** Where what became of an input shows. */
export const INPUT_PLACES = {
  row: "its row in the desktop's New input list",
  inputs: 'its row on the Inputs page',
  line: "the line over the phone's box (New input)",
  talk: "under your message in the item's talk",
  sheet: 'its menu (⋯, a long press) and Move',
} as const
export type InputPlace = keyof typeof INPUT_PLACES

/** busy: blue, moving; failed: red; done: green; quiet: grey; plain: the items it went to, as links */
export type InputTone = 'busy' | 'failed' | 'done' | 'quiet' | 'plain'

/** Under your words in an item, what they made there (B714 #10594): → Created B713. */
export const MADE_WORD = 'Created'

/** What can be done about it: ask the organizer again after it failed (Retry) or after its filing was undone
 * (Organize), send a recording kept as cancelled, open what it went to, take back what the organizer filed, move it
 * to another project. */
export type InputAct = 'retry' | 'organize' | 'send' | 'open' | 'undo' | 'move'
export const INPUT_ACT_WORD: Record<InputAct, string> = { retry: 'Retry', organize: 'Organize', send: 'Send', open: 'Open', undo: 'Undo', move: 'Move to…' }

interface StateDef {
  label: string
  /** its words, the same in every place ('' : they are what it names: its items, the organizer's note) */
  say: string
  tone: InputTone
  /** a voice message in this state is in this one of model/voiceStates (null: none of its own) */
  voice: VoiceState | null
  /** it ended up somewhere: the line over the box lets it go after a while */
  settled: boolean
  /** what each place shows: these acts beside its words; null: it does not show there */
  show: Record<InputPlace, readonly InputAct[] | null>
}

const LISTS = <T extends readonly InputAct[]>(acts: T) => ({ row: acts, inputs: acts })

/** Every state, the normal way first. */
export const INPUT_STATES = {
  // its voice notes' words still to come (each place says it as model/voiceStates does), or more said into it
  transcribing: { label: 'Its words to come', say: 'Transcribing…', tone: 'busy', voice: 'sentTranscribing', settled: false, show: { ...LISTS([]), line: [], talk: [], sheet: [] } },
  // the organizer on it now, next in line or asking its service again after a busy answer: one word (B684)
  organizing: { label: 'Organizing', say: 'Organizing…', tone: 'busy', voice: 'organizing', settled: false, show: { ...LISTS([]), line: [], talk: null, sheet: [] } },
  filed: { label: 'Made or changed items', say: '', tone: 'plain', voice: 'added', settled: true, show: { ...LISTS([]), line: ['open', 'undo', 'move'], talk: [], sheet: ['undo', 'move'] } },
  answer: { label: 'An answer on its item', say: 'Answer to', tone: 'plain', voice: 'added', settled: true, show: { ...LISTS([]), line: ['open', 'undo', 'move'], talk: null, sheet: ['undo', 'move'] } },
  agent: { label: 'For an agent', say: 'For an agent', tone: 'quiet', voice: 'forAgent', settled: true, show: { ...LISTS([]), line: ['move'], talk: null, sheet: ['move'] } },
  note: { label: 'Nothing filed, the organizer said why', say: '', tone: 'quiet', voice: 'handled', settled: true, show: { ...LISTS([]), line: ['move'], talk: null, sheet: ['move'] } },
  handled: { label: 'Handled', say: 'Handled', tone: 'done', voice: 'handled', settled: true, show: { ...LISTS([]), line: ['move'], talk: null, sheet: ['move'] } },
  // a failure that does not go away by itself (its key refused): Retry once it is fixed; a busy service is asked again
  // by Taska itself (T424), so that one is organizing
  failed: { label: "Couldn't organize", say: "Couldn't organize", tone: 'failed', voice: 'organizeFailed', settled: false, show: { ...LISTS(['retry']), line: ['retry'], talk: null, sheet: ['move'] } },
  undone: { label: 'Its filing undone', say: 'Undone', tone: 'quiet', voice: null, settled: true, show: { ...LISTS(['organize']), line: ['organize'], talk: null, sheet: ['move'] } },
  // a recording cancelled with Esc, kept: Send sends it after all (B627)
  cancelled: { label: 'Recording kept as cancelled', say: 'Cancelled', tone: 'quiet', voice: 'cancelled', settled: true, show: { ...LISTS(['send']), line: null, talk: null, sheet: ['send', 'move'] } },
  moved: { label: 'Moved to another project', say: 'Moved to', tone: 'plain', voice: null, settled: true, show: { ...LISTS(['open']), line: ['open'], talk: ['open'], sheet: null } },
} as const satisfies Record<string, StateDef>

export type InputState = keyof typeof INPUT_STATES
export const INPUT_STATE_LIST = Object.keys(INPUT_STATES) as InputState[]

/** What happens to an input once Taska has it, in a few words (the diagram's labels). */
export const INPUT_EVENTS = {
  sent: 'Taska has it',
  kept: 'Esc (New input: kept)',
  send: 'Send',
  words: 'Its words in',
  filed: 'Made or changed items',
  answered: 'Filed as an answer',
  note: 'Nothing to file, said why',
  nothing: 'Nothing to do',
  left: 'Left for an agent',
  busy: 'Service busy: asked again by itself',
  failed: 'Organizer failed',
  retry: 'Retry',
  organize: 'Organize',
  undo: 'Undo',
  agentDid: 'An agent did it',
  edited: 'Edited after sending',
  addMore: 'More voice said into it',
  move: 'Moved to another project',
} as const
export type InputEvent = keyof typeof INPUT_EVENTS

export interface InputStep {
  /** null: where it starts */
  from: InputState | null
  on: InputEvent
  to: InputState
}

const each = (from: readonly (InputState | null)[], on: InputEvent, to: readonly InputState[]): InputStep[] => from.flatMap((f) => to.map((t) => ({ from: f, on, to: t })))
/** where it goes once Taska may read it: its words to come, the organizer on, or, none on, for an agent */
const READ = ['transcribing', 'organizing', 'agent'] as const
const ENDED = ['filed', 'answer', 'agent', 'note', 'handled'] as const

/** Every way an input can go once Taska has it: from a state, on an event, to a state (where Taska decides, one event
 * has more than one). Nothing else is allowed. */
export const INPUT_STEPS: readonly InputStep[] = [
  ...each([null], 'sent', READ),
  { from: null, on: 'kept', to: 'cancelled' },
  ...each(['cancelled'], 'send', READ),
  ...each(['transcribing'], 'words', ['organizing', 'agent']),
  { from: 'organizing', on: 'filed', to: 'filed' },
  { from: 'organizing', on: 'answered', to: 'answer' },
  { from: 'organizing', on: 'note', to: 'note' },
  { from: 'organizing', on: 'nothing', to: 'handled' },
  { from: 'organizing', on: 'left', to: 'agent' },
  { from: 'organizing', on: 'busy', to: 'organizing' },
  { from: 'organizing', on: 'failed', to: 'failed' },
  ...each(['failed'], 'retry', ['organizing', 'agent']),
  ...each(['undone'], 'organize', ['organizing', 'agent']),
  ...each(['filed', 'answer'], 'undo', ['undone']),
  ...each(['agent'], 'agentDid', ['filed', 'handled']),
  ...each([...ENDED, 'undone', 'failed'], 'edited', ['organizing', 'agent']),
  ...each(ENDED, 'addMore', ['transcribing']),
  ...each(INPUT_STATE_LIST.filter((s) => s !== 'moved'), 'move', ['moved']),
]

/** Whether an input can go from one state straight to another. */
export const canGo = (from: InputState | null, to: InputState) => INPUT_STEPS.some((s) => s.from === from && s.to === to)

/** Where an act takes it (none: it is not a way it goes; Open only shows what it went to). */
export const ACT_EVENT: Partial<Record<InputAct, InputEvent>> = { retry: 'retry', organize: 'organize', send: 'send', undo: 'undo', move: 'move' }

/** What there is besides the input: another project to move it to. */
export interface InputWith {
  others: boolean
}

/** What can be done about `b` in `place`, as the table says there and as it can be now: Retry and Organize when the
 * organizer is on to take it (`retry`), Undo when Taska would take back its filing (`undo`), Move when there is
 * another project. */
export function actsIn(b: Became, place: InputPlace, w: InputWith): InputAct[] {
  const acts: readonly InputAct[] = INPUT_STATES[b.k].show[place] ?? []
  return acts.filter((a) => {
    if (a === 'retry' || a === 'organize') return b.k === 'failed' || b.k === 'undone' ? b.retry : false
    if (a === 'undo') return b.k === 'filed' || b.k === 'answer' ? b.undo : false
    if (a === 'move') return w.others
    if (a === 'open') return b.k === 'moved' || (b.k === 'filed' && b.items.length > 0) || b.k === 'answer'
    return true
  })
}

/** Whether `place` shows what became of it at all. */
export const showsIn = (b: Became, place: InputPlace) => INPUT_STATES[b.k].show[place] !== null

const VOICE_PLACE: Record<InputPlace, VoicePlace> = { row: 'row', inputs: 'row', line: 'line', talk: 'talk', sheet: 'row' }
const say = (s: string) => s[0].toUpperCase() + s.slice(1)

/** What became of it, in words, as `place` says it: its state's words, with what it names (the items and what was done
 * to each, said once over the items it was done to; why it failed; where it went). */
export function becameText(b: Became, place: InputPlace): string {
  const W = INPUT_STATES[b.k].say
  switch (b.k) {
    case 'transcribing':
      return sayIn(b.state, VOICE_PLACE[place])?.say ?? W
    case 'failed':
      return `${W} · ${b.why}`
    case 'answer':
      return `${W} ${b.item.code}`
    case 'filed':
      return [...b.items.map((x, i) => [x.did && !(i && b.items[i - 1].did === x.did) ? x.did : '', x.item.code].filter(Boolean).join(' ')), ...(b.note ? [say(b.note)] : [])].join(' · ')
    case 'note':
      return say(b.text)
    case 'moved':
      return `${W} ${b.to}`
    default:
      return W
  }
}

/** The state of model/voiceStates a voice message is in, from what became of its input: one that made an item is
 * Created, its words still to come are as Taska's records have them (or more said into it: adding). */
export function voiceStateOf(b: Became): VoiceState | null {
  if (b.k === 'transcribing') return b.state
  if (b.k === 'filed' && b.items.some((x) => x.did === 'Created')) return 'created'
  return INPUT_STATES[b.k].voice
}

/** The organizer or an agent has had it (as Taska's input_states.reached): taking it back quietly is too late. */
export const reached = (r: Pick<Input, 'id' | 'acked' | 'org'>, organizer: { busy: readonly string[] }) => r.acked || !!r.org || organizer.busy.includes(r.id)

// ---------------------------------------------------------------- the diagram and the table (docs/inputs.md)

/** The states and every way between them as a Mermaid flowchart (the events that go the same way are one arrow). */
export function inputDiagram(): string {
  const lines = ['flowchart TD', '    start(("sent"))']
  for (const s of INPUT_STATE_LIST) lines.push(`    ${s}["${INPUT_STATES[s].label}"]`)
  const ways = new Map<string, InputEvent[]>()
  for (const s of INPUT_STEPS) {
    // every state can be moved: one note instead of an arrow from each
    if (s.on === 'move') continue
    const key = `${s.from ?? 'start'} ${s.to}`
    const on = ways.get(key) ?? []
    if (!on.includes(s.on)) on.push(s.on)
    ways.set(key, on)
  }
  for (const [key, on] of ways) {
    const [from, to] = key.split(' ')
    lines.push(`    ${from} -->|"${on.map((e) => INPUT_EVENTS[e]).join(' · ')}"| ${to}`)
  }
  lines.push(`    any(("any state")) -->|"${INPUT_EVENTS.move}"| moved`)
  return lines.join('\n')
}

/** what the table says for the states whose words are what they name; the talk shows only the items it made there */
const WORDS: Partial<Record<InputState, string>> = { filed: 'its items: Created B014 · Added to F012', answer: 'Answer to T007', note: "the organizer's words", failed: "Couldn't organize · why", transcribing: 'as model/voiceStates says it', moved: 'Moved to Shop' }
const TALK_WORDS: Partial<Record<InputState, string>> = { filed: `→ ${MADE_WORD} B713 (the items it made there)` }

/** What each place shows in each state, as a Markdown table; —: nothing. */
export function inputPlacesTable(): string {
  const places = Object.keys(INPUT_PLACES) as InputPlace[]
  const cell = (s: InputState, p: InputPlace) => {
    const acts = INPUT_STATES[s].show[p]
    if (!acts) return '—'
    const words = p === 'sheet' ? '' : `${(p === 'talk' && TALK_WORDS[s]) || WORDS[s] || INPUT_STATES[s].say} (${INPUT_STATES[s].tone})`
    return [words, acts.map((a) => INPUT_ACT_WORD[a]).join(', ')].filter(Boolean).join(' · ') || '(nothing to do)'
  }
  return [
    `| State | ${places.map((p) => INPUT_PLACES[p]).join(' | ')} |`,
    `|---|${places.map(() => '---').join('|')}|`,
    ...INPUT_STATE_LIST.map((s) => `| ${INPUT_STATES[s].label} (\`${s}\`) | ${places.map((p) => cell(s, p)).join(' | ')} |`),
  ].join('\n')
}
