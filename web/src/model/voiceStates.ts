// A voice message's states, in one place (T726): every state a voice note goes through from recording to what its
// input became, the event that moves it from each state to the next (the only ways it can go), the toast an event
// says, and what each place shows in each state. Every place that shows a voice note's state reads it here; nothing
// else decides those words. The diagram in docs/voice.md is made from this table (`voiceDiagram`, checked by a test).
//
// Before it is sent the note is the page's own (a draft's file, the box store): its state is worked out from what is
// kept of it by `noteState`, and changed only by `noteStep`. Once Taska has it, Taska's record of its words is the
// truth (server/taska/domain/voice_states.py: wait, done, none, failed), read by `sentNotes`, and what its input
// became is the input's (model/inputStates: each of its states names the voice state it is, `voiceStateOf`). On its
// way, the outbox's phase names it (model/outgoingStates). Pure.

import type { FileRef, Voice, WordsAnswer } from './types'
import { fileState, goingUp, type UpFields } from './fileStates'

/** The states of a voice note's one record on the server (server/taska/domain/voice_states.py): being worked out
 * (its fast words meanwhile, when they came), its words in, nobody heard, failed. */
export const RECORD_STATES = ['wait', 'done', 'none', 'failed'] as const
export type RecordState = (typeof RECORD_STATES)[number]

/** Where a draft's note's words are, as the page keeps it: Taska's record state, and `fast` (its fast words in, the
 * strong model's still to come: a record that waits, with its first words). */
export type Transcript = RecordState | 'fast'

/** Where a voice message's state shows. */
export const VOICE_PLACES = {
  chip: "the note's chip in the box",
  card: "the Draft card (the desktop's New input page)",
  row: "its row in the desktop's New input list",
  line: "the line over the phone's box (New input)",
  talk: "your bubble in the item's talk",
} as const
export type VoicePlace = keyof typeof VOICE_PLACES

/** busy: blue, pulsing; partial: amber; done: green; quiet: grey; failed: red */
export type VoiceTone = 'busy' | 'partial' | 'done' | 'quiet' | 'failed'

/** What a place shows in a state. */
export type Show =
  /** these words, in this tone */
  | { say: string; tone: VoiceTone }
  /** its words (typed and heard), nothing said of them */
  | 'words'
  /** what is on its way says where it is, as for anything sent (model/outgoingStates: Sending…, Uploading…, Waiting for
   * Taska…, Not sent) */
  | 'going'
  /** the input's own words for what became of it, as for any input (model/inputStates: Organizing…, Created B014, For an
   * agent, ...) */
  | 'became'
  /** nothing: the note's state does not show there */
  | null

type Phase = 'draft' | 'going' | 'sent'
interface StateDef {
  phase: Phase
  label: string
  show: Record<VoicePlace, Show>
}

const TRANSCRIBING: Show = { say: 'Transcribing…', tone: 'busy' }
const NOTHING = { chip: null, card: null, row: null, line: null, talk: null } as const
const IN_BOX = { row: null, line: null, talk: null } as const
const GOING = { chip: null, card: null, row: 'going', line: 'going', talk: 'going' } as const
/** sent, its words still to come */
const SENT_HEARING = { chip: null, card: null, row: TRANSCRIBING, line: { say: 'Sent · transcribing…', tone: 'busy' }, talk: { say: 'transcribing', tone: 'busy' } } as const
/** the first words are in, the strong model is still confirming them: no longer "transcribing" (r1217) */
const CONFIRMING: Show = { say: 'Confirming…', tone: 'busy' }
const SENT_CONFIRMING = { ...SENT_HEARING, row: CONFIRMING, line: { say: 'Sent · confirming…', tone: 'busy' }, talk: { say: 'confirming', tone: 'busy' } } as const
/** what became of it: the input's line says it; the item's talk stays as sent */
const BECAME = { chip: null, card: null, row: 'became', line: 'became', talk: null } as const

/** Every state, the normal way first. */
export const VOICE_STATES = {
  // in a draft: the note is the page's own
  recording: { phase: 'draft', label: 'Recording', show: NOTHING },
  uploading: { phase: 'draft', label: 'Uploading', show: { chip: TRANSCRIBING, card: TRANSCRIBING, ...IN_BOX } },
  transcribing: { phase: 'draft', label: 'Transcribing', show: { chip: TRANSCRIBING, card: TRANSCRIBING, ...IN_BOX } },
  fastWords: { phase: 'draft', label: 'Fast words, confirming', show: { chip: { say: 'Confirming…', tone: 'partial' }, card: 'words', ...IN_BOX } },
  words: { phase: 'draft', label: 'Words final', show: { chip: { say: 'Transcribed', tone: 'done' }, card: 'words', ...IN_BOX } },
  noWords: { phase: 'draft', label: 'No words heard', show: { chip: { say: 'No words heard · audio only', tone: 'quiet' }, card: { say: 'No words', tone: 'quiet' }, ...IN_BOX } },
  wordsFailed: { phase: 'draft', label: 'Writing it out failed', show: { chip: { say: 'No transcript · audio only', tone: 'quiet' }, card: { say: 'No words', tone: 'quiet' }, ...IN_BOX } },
  uploadFailed: { phase: 'draft', label: 'Upload failed', show: { chip: { say: 'Upload failed', tone: 'failed' }, card: { say: 'Upload failed', tone: 'failed' }, ...IN_BOX } },
  // on its way (the outbox)
  sending: { phase: 'going', label: 'Sending', show: GOING },
  offline: { phase: 'going', label: 'Waiting for Taska', show: GOING },
  notSent: { phase: 'going', label: 'Not sent', show: GOING },
  // Taska has it: its words as Taska's record has them, then what its input became
  sentTranscribing: { phase: 'sent', label: 'Sent, words to come', show: SENT_HEARING },
  sentFastWords: { phase: 'sent', label: 'Sent with the fast words, confirming', show: SENT_CONFIRMING },
  organizing: { phase: 'sent', label: 'Organizing', show: BECAME },
  created: { phase: 'sent', label: 'Created an item', show: { ...BECAME, talk: 'became' } },
  added: { phase: 'sent', label: 'Added to an item', show: BECAME },
  forAgent: { phase: 'sent', label: 'For an agent', show: BECAME },
  handled: { phase: 'sent', label: 'Handled by an agent', show: BECAME },
  organizeFailed: { phase: 'sent', label: "Couldn't organize", show: BECAME },
  cancelled: { phase: 'sent', label: 'Recording cancelled', show: { ...BECAME, line: null } },
  adding: { phase: 'sent', label: 'More voice added', show: { chip: null, card: null, row: TRANSCRIBING, line: null, talk: null } },
} as const satisfies Record<string, StateDef>

export type VoiceState = keyof typeof VOICE_STATES
export const VOICE_STATE_LIST = Object.keys(VOICE_STATES) as VoiceState[]

/** What happens to a voice message, in a few words (the diagram's labels). */
export const VOICE_EVENTS = {
  record: 'Record',
  stop: 'Stop',
  cancel: 'Esc (New input: kept)',
  uploaded: 'Upload ok',
  uploadOffline: 'Taska out of reach: tried again',
  uploadRefused: 'Upload refused',
  fast: 'Fast words in',
  strong: 'Strong words in',
  fastKept: 'Strong model failed or said the same',
  nothing: 'Nothing heard',
  failed: 'Transcription failed',
  send: 'Send',
  offline: 'Taska out of reach',
  refused: 'Refused',
  back: 'Taska back',
  retry: 'Retry',
  taken: 'Taska has it',
  created: 'Made an item',
  added: 'Added to an item',
  agent: 'Left for an agent',
  handled: 'Handled',
  organizeFailed: 'Organizer failed',
  edited: 'Edited after sending',
  addMore: 'More voice said into it',
} as const
export type VoiceEvent = keyof typeof VOICE_EVENTS

export interface VoiceStep {
  /** null: where a voice message starts */
  from: VoiceState | null
  on: VoiceEvent
  to: VoiceState
  /** the toast the page shows when it goes this way */
  toast?: string
}

const UPLOAD_FAILED = 'Recording upload failed'
const each = (from: readonly VoiceState[], on: VoiceEvent, to: VoiceState, toast?: string): VoiceStep[] => from.map((f) => ({ from: f, on, to, ...(toast ? { toast } : {}) }))
const BEFORE_SEND = ['recording', 'uploading', 'transcribing', 'fastWords', 'words', 'noWords', 'wordsFailed'] as const
const SETTLED = ['created', 'added', 'forAgent', 'handled'] as const
const HEARING = ['sentTranscribing', 'sentFastWords'] as const
const READ = ['organizing', 'forAgent'] as const

/** Every way a voice message can go: from a state, on an event, to a state (where Taska decides, one event has more
 * than one: its words final, the organizer takes it, or, none on, it is for an agent). Nothing else is allowed. */
export const VOICE_STEPS: readonly VoiceStep[] = [
  { from: null, on: 'record', to: 'recording' },
  { from: 'recording', on: 'stop', to: 'uploading' },
  { from: 'recording', on: 'cancel', to: 'cancelled' },
  { from: 'uploading', on: 'uploaded', to: 'transcribing' },
  { from: 'uploading', on: 'uploadOffline', to: 'uploading' },
  { from: 'uploading', on: 'uploadRefused', to: 'uploadFailed', toast: UPLOAD_FAILED },
  { from: 'transcribing', on: 'fast', to: 'fastWords' },
  { from: 'transcribing', on: 'strong', to: 'words' },
  { from: 'transcribing', on: 'nothing', to: 'noWords', toast: 'No words heard. Audio is ready to send' },
  { from: 'transcribing', on: 'failed', to: 'wordsFailed', toast: 'Transcription failed. Audio is ready to send' },
  // the strong words take the fast ones' place, with what may be misheard in them (B724: kept, to check)
  { from: 'fastWords', on: 'strong', to: 'words', toast: 'More complete transcription added' },
  { from: 'fastWords', on: 'fastKept', to: 'words' },
  // sent at any time, also before its words are in (they come after: sentTranscribing, sentFastWords)
  ...each(BEFORE_SEND, 'send', 'sending'),
  { from: 'cancelled', on: 'send', to: 'sending' },
  // sent before its note is up: it goes once the note is (refused, it goes without it)
  { from: 'sending', on: 'uploaded', to: 'sending' },
  { from: 'sending', on: 'uploadOffline', to: 'sending' },
  { from: 'sending', on: 'uploadRefused', to: 'sending', toast: UPLOAD_FAILED },
  { from: 'sending', on: 'offline', to: 'offline' },
  { from: 'offline', on: 'back', to: 'sending' },
  { from: 'sending', on: 'refused', to: 'notSent' },
  { from: 'notSent', on: 'retry', to: 'sending' },
  { from: 'sending', on: 'taken', to: 'sentTranscribing' },
  { from: 'sending', on: 'taken', to: 'sentFastWords' },
  ...READ.map((to): VoiceStep => ({ from: 'sending', on: 'taken', to })),
  { from: 'sentTranscribing', on: 'fast', to: 'sentFastWords' },
  ...HEARING.flatMap((from) => READ.map((to): VoiceStep => ({ from, on: 'strong', to }))),
  ...READ.map((to): VoiceStep => ({ from: 'sentFastWords', on: 'fastKept', to })),
  ...READ.map((to): VoiceStep => ({ from: 'sentTranscribing', on: 'nothing', to, toast: 'No words heard. Audio sent as is' })),
  ...READ.map((to): VoiceStep => ({ from: 'sentTranscribing', on: 'failed', to, toast: 'Transcription failed. Audio sent as is' })),
  { from: 'organizing', on: 'created', to: 'created' },
  { from: 'organizing', on: 'added', to: 'added' },
  { from: 'organizing', on: 'agent', to: 'forAgent' },
  { from: 'organizing', on: 'handled', to: 'handled' },
  { from: 'organizing', on: 'organizeFailed', to: 'organizeFailed' },
  { from: 'organizeFailed', on: 'retry', to: 'organizing' },
  { from: 'forAgent', on: 'added', to: 'added' },
  { from: 'forAgent', on: 'handled', to: 'handled' },
  ...SETTLED.flatMap((from) => READ.map((to): VoiceStep => ({ from, on: 'edited', to }))),
  ...each(SETTLED, 'addMore', 'adding'),
  { from: 'adding', on: 'taken', to: 'sentTranscribing' },
  // a cancelled note's words come all the same: it stays cancelled
  { from: 'cancelled', on: 'fast', to: 'cancelled' },
  { from: 'cancelled', on: 'strong', to: 'cancelled' },
  { from: 'cancelled', on: 'nothing', to: 'cancelled', toast: 'No words heard. The cancelled recording is kept as is' },
  { from: 'cancelled', on: 'failed', to: 'cancelled', toast: 'Transcription failed. The cancelled recording is kept as is' },
]

/** Where `on` takes a message in state `from`: the states it can be in next (none: it cannot go that way). */
export const nextStates = (from: VoiceState | null, on: VoiceEvent): VoiceState[] => VOICE_STEPS.filter((s) => s.from === from && s.on === on).map((s) => s.to)

/** Whether a message can go from one state straight to another. */
export const canGo = (from: VoiceState | null, to: VoiceState) => VOICE_STEPS.some((s) => s.from === from && s.to === to)

/** What a place shows in a state. */
export const showIn = (state: VoiceState, place: VoicePlace): Show => VOICE_STATES[state].show[place]

/** The words a place says in a state, with their tone; null when it says none of its own there. */
export const sayIn = (state: VoiceState, place: VoicePlace): { say: string; tone: VoiceTone } | null => {
  const s = showIn(state, place)
  return s && typeof s === 'object' ? s : null
}

// ---------------------------------------------------------------- a note in a draft (the page's own)

/** What the page keeps of a note in a draft (or on its way) that its state is worked out from. */
export interface NoteFields extends UpFields {
  mime?: string
  transcript?: Transcript
}

/** A note just stopped: going up, its words still to come. */
export const NOTE_STOPPED = { uploading: true, transcript: 'wait' } as const satisfies NoteFields

const HEARD_STATE: Record<Transcript, VoiceState> = { wait: 'transcribing', fast: 'fastWords', done: 'words', none: 'noWords', failed: 'wordsFailed' }

/** A draft's note's state, from what is kept of it: the one place it is worked out. */
export function noteState(f: NoteFields): VoiceState {
  // going up or refused, as any file (model/fileStates); up, where its words are
  const up = fileState(f)
  if (up === 'failed') return 'uploadFailed'
  if (up === 'uploading') return 'uploading'
  return HEARD_STATE[f.transcript ?? 'wait']
}

/** A draft's notes together, as its Draft card says it: the one furthest from done. */
export function notesState(files: readonly NoteFields[]): VoiceState | null {
  const order: VoiceState[] = ['uploading', 'transcribing', 'uploadFailed', 'fastWords', 'wordsFailed', 'noWords', 'words']
  const states = files.filter(isNote).map(noteState)
  return order.find((s) => states.includes(s)) ?? null
}

/** A voice note still going up or still waiting for its words (sending a comment waits for them). */
export const waitsForWords = (f: NoteFields) => isNote(f) && (['uploading', 'transcribing'] as VoiceState[]).includes(noteState(f))

/** A file still going up, or a voice note still waiting for its words: what it goes with (a comment, the page's
 * reload) waits for it. */
export const stillComing = (f: NoteFields) => goingUp(f) || waitsForWords(f)

const isNote = (f: { mime?: string }) => (f.mime || '').startsWith('audio/')

/** What each event changes of what is kept of a note. */
const CHANGES: Partial<Record<VoiceEvent, NoteFields>> = {
  uploaded: { uploading: false, failed: false },
  uploadOffline: {},
  uploadRefused: { uploading: false, failed: true },
  fast: { transcript: 'fast' },
  strong: { transcript: 'done' },
  fastKept: { transcript: 'done' },
  nothing: { transcript: 'none' },
  failed: { transcript: 'failed' },
}

/** Where a note the page holds is: in its draft, sent, or sent to be kept as cancelled. */
export type NoteAt = 'draft' | 'sent' | 'cancelled'

/** The state of the message a note the page holds is in: its draft's note's; sent, on its way while the note goes
 * up, then (Taska has it, or will in a moment) its words to come, or kept as cancelled. */
function stateAt(f: NoteFields, at: NoteAt): VoiceState {
  if (at === 'draft') return noteState(f)
  if (goingUp(f)) return 'sending'
  return at === 'cancelled' ? 'cancelled' : f.transcript === 'fast' ? 'sentFastWords' : 'sentTranscribing'
}

/** A note the page holds moved on by `on`: what changes of what is kept of it, and the toast that says so; null when
 * it cannot go that way from where it is (then nothing changes). The one way the page changes a note's state. */
export function noteStep(f: NoteFields, at: NoteAt, on: VoiceEvent): { change: NoteFields; toast?: string } | null {
  const from = stateAt(f, at)
  const step = VOICE_STEPS.find((s) => s.from === from && s.on === on)
  const change = CHANGES[on]
  if (!step || !change) return null
  return { change, ...(step.toast ? { toast: step.toast } : {}) }
}

/** The event Taska's answer about a note's words is (its record's state, the truth); null: still to come. */
export function heardEvent(a: Pick<WordsAnswer, 'state' | 'more' | 'tr'>): VoiceEvent | null {
  if (a.state === 'wait') return a.more && a.tr ? 'fast' : null
  return a.state === 'done' ? 'strong' : a.state === 'none' ? 'nothing' : 'failed'
}

/** What is kept of a note in this browser (with its audio, until Taska has it) says of its words: null while they
 * are to come, '' and an error when they failed. */
export const keptTranscript = (f: NoteFields & { tr?: string }): { tr: string | null; tr_error: string } =>
  f.transcript === 'wait' || f.transcript === undefined ? { tr: null, tr_error: '' } : { tr: f.tr || '', tr_error: f.transcript === 'failed' ? 'failed' : '' }

/** A kept note's words as they were kept, read back. */
export const fromKept = (r: { tr: string | null; tr_error: string }): Transcript => (r.tr == null && !r.tr_error ? 'wait' : r.tr_error ? 'failed' : r.tr ? 'done' : 'none')

// ---------------------------------------------------------------- once Taska has it (its record is the truth)

/** A sent message's notes, as Taska's records have them: their words still to come (some fast words in, or none
 * yet), or null: every note's words are final (in, nobody heard, or failed). */
export function sentNotes(files: readonly FileRef[] | undefined): 'sentTranscribing' | 'sentFastWords' | null {
  const waiting = (files || []).filter((f) => isNote(f) && f.voice?.state === 'wait')
  if (!waiting.length) return null
  return waiting.every((f) => f.voice?.early) ? 'sentFastWords' : 'sentTranscribing'
}

/** What a sent note says where it has no words to show: being worked out, nobody was heard, or it failed. */
const LACKS: Record<RecordState, string> = { wait: 'Transcribing…', done: 'No words heard', none: 'No words heard', failed: 'Transcription failed' }
export const voiceLacks = (v: Voice | null | undefined): string => LACKS[v?.state ?? 'wait']

// ---------------------------------------------------------------- the diagram (docs/voice.md)

/** The states and every way between them as a Mermaid flowchart, its labels in double quotes (the events that go
 * the same way are one arrow). */
export function voiceDiagram(): string {
  const lines = ['flowchart TD', '    start(("start"))']
  for (const s of VOICE_STATE_LIST) lines.push(`    ${s}["${VOICE_STATES[s].label}"]`)
  const ways = new Map<string, VoiceEvent[]>()
  for (const s of VOICE_STEPS) {
    const key = `${s.from ?? 'start'} ${s.to}`
    const on = ways.get(key) ?? []
    if (!on.includes(s.on)) on.push(s.on)
    ways.set(key, on)
  }
  for (const [key, on] of ways) {
    const [from, to] = key.split(' ')
    lines.push(`    ${from} -->|"${on.map((e) => VOICE_EVENTS[e]).join(' · ')}"| ${to}`)
  }
  return lines.join('\n')
}

const SHOWN: Record<Exclude<Show, { say: string } | null>, string> = { words: 'its words', going: 'where it is on its way', became: 'what became of it' }

/** What each place shows in each state, as a Markdown table (docs/voice.md); —: nothing. */
export function voicePlacesTable(): string {
  const places = Object.keys(VOICE_PLACES) as VoicePlace[]
  const cell = (s: Show) => (s === null ? '—' : typeof s === 'object' ? `${s.say} (${s.tone})` : SHOWN[s])
  return [
    `| State | ${places.map((p) => VOICE_PLACES[p]).join(' | ')} |`,
    `|---|${places.map(() => '---').join('|')}|`,
    ...VOICE_STATE_LIST.map((s) => `| ${VOICE_STATES[s].label} (\`${s}\`) | ${places.map((p) => cell(showIn(s, p))).join(' | ')} |`),
  ].join('\n')
}
