// A voice message from start to end, on one page (T722, D127): how its words are worked out (two models at once:
// fast words first, the strong model's words replace them), then each state of model/voiceStates (T726) as a row in four places: the New input
// and an item, each on the desktop and the phone. The normal ways first, the other outcomes and branches after. Every
// cell is drawn as the state's own story draws it (the box, the New input page's list, the line over the phone's box,
// the item's talk), with the same fixtures; where a state shows nothing, the cell says so.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { spotsIn, type HeardFile } from '../../model/doubts'
import type { FileRef, Input, Item, Message } from '../../model/types'
import type { Outgoing } from '../../model/outgoing'
import { Frame } from '../../stories/Frames'
import { VOICE, boxAt, out as outgoing, sentLine, toastOver, type Here } from '../../stories/boxFixtures'
import { org } from '../../stories/composerSentFixtures'
import { HEARD, HEARD_TEXT } from '../../stories/doubtFixtures'
import { AGAIN, AGAIN_HEARD, LiveWords } from '../../stories/doubtsFixtures'
import { T, input, item, message, record, shown, waiting } from '../../stories/fixtures'
import { later, mine, out, r4, voice } from '../../stories/fromYouFixtures'
import { ONE, cardOf, saidOf, type Said } from '../../stories/inputFixtures'
import { talkOf } from '../../stories/itemPage'
import { VOICE_STATE_LIST, VOICE_STATES, VOICE_STEPS, notesState, sayIn, type VoiceEvent, type VoiceState } from '../../model/voiceStates'
import { DraftCard, DRAFT_WORDS, type DraftHint } from './DraftCard'
import type { DraftFile } from './DraftFiles'

export default { title: 'UI/Input box/Voice/Whole workflow' } satisfies Meta
type Story = StoryObj

const DESK = 640
const PHONE = 393

// ---------------------------------------------------------------- the words

// a new input said on the New input page (r25), and one sent before its words were final (r26)
const N1_FAST = 'So the coupon box, um, it hides behind the keyboard on the phone'
const N1 = 'The coupon box hides behind the keyboard on the phone.'
const N1_HEARD = 'So the coupon box, um, it hides behind the keyboard on the phone.'
const N1_EDITED = 'The coupon box hides behind the keyboard on the iPhone.'
const N2_FAST = 'Keep the filter and, um, the sort as well'
const N2 = 'Keep the filter, and the sort as well.'
// a reply said in F012 (r4): one that also made a new bug (B714 #10594), and one sent before its words were final
const I1_FAST = 'The export should keep the filter I set also on the phone the export button does nothing at all'
const I1 = 'The export should keep the filter I set. Also, on the phone the Export button does nothing at all.'
const I1_HEARD = 'The export should keep the filter I set. And also, um, on the phone the Export button does nothing at all.'
const I2_FAST = 'So the export should, um, keep the filter I set'
const I2 = voice.tr
const I2_EDITED = 'The export should keep the filter and the sort I set.'

const NOTE: FileRef = { f: VOICE.f, name: VOICE.name, mime: VOICE.mime }
const NOTE2: FileRef = { f: 'f6-voice_0-05.webm', name: 'voice_0-05.webm', mime: 'audio/webm' }
const NOTE_R4: FileRef = { f: voice.f, name: voice.name, mime: voice.mime }

/** an input said by voice alone, its words its note's (B682) */
const voiced = (r: Partial<Input> & { id: string }, note: FileRef, words: string, heard = words): Input =>
  shown(input({ ...r, text: '', files: [note] }), record(note.f, words, heard))
/** sent before its words were final: the fast words while the strong model works (T687) */
const early = (r: Partial<Input> & { id: string }, note: FileRef, fast: string): Input => shown(input({ ...r, text: '', files: [note] }), waiting(note.f, fast))

// the New input's inputs, as each state has them
const GOING = outgoing({ text: '', files: [NOTE], words: { [NOTE.f]: N1 } })
const ORGANIZING = voiced({ id: 'r25' }, NOTE, N1, N1_HEARD)
const MADE = voiced({ id: 'r25', acked: true, touched: [14], org: org(true, 'Created B014') }, NOTE, N1, N1_HEARD)
const SENT_BARE = shown(input({ id: 'r26', text: '', files: [NOTE2] }), waiting(NOTE2.f))
const EARLY = early({ id: 'r26' }, NOTE2, N2_FAST)
const SWAPPED = voiced({ id: 'r26' }, NOTE2, N2, N2_FAST)
const ADDED = voiced({ id: 'r26', acked: true, touched: [12], org: org(true, 'Noted on F012') }, NOTE2, N2, N2_FAST)
const LEFT = voiced({ ...ONE.left, t: T }, NOTE2, ONE.left.text, 'Look at, hmm, why the build takes so long.')
const HANDLED = voiced({ ...ONE.handled, t: T }, NOTE2, ONE.handled.text, 'Look at, hmm, why the build takes so long.')
const NOT_ORGANIZED = voiced({ id: 'r25', org: org(false, 'Gemini HTTP 503: overloaded') }, NOTE, N1, N1_HEARD)
const EDITED = voiced({ id: 'r25', acked: true, touched: [14], org: org(true, 'Created B014'), history: [{ text: N1, t: T, mode: 'edit' }], updated: later(3) }, NOTE, N1_EDITED, N1_HEARD)

// the item's talk: an agent asked, you answered by voice
const ASKED = message({ id: 1, by: 'claude-code', kind: 'say', text: 'Which filter should the export keep?' })
const you = (text: string, f: Partial<Message> = {}) => mine({ id: 2, text, ...f })
const r4Said = (words: string, heard: string, f: Partial<Input> = {}) => r4({ text: '', files: [{ ...NOTE_R4, voice: record(NOTE_R4.f, words, heard) }], ...f })
const PHONE_BUG = item({ n: 16, type: 'bug', pri: 'P1', title: 'Export does nothing on the phone', srcs: ['r4'], t0: later(1), body: I1 })
const MADE_HERE = r4Said(I1, I1_HEARD, { scope: 12, touched: [16], acked: true, org: { ...org(true, 'Created B016'), t: later(1) } })

// ---------------------------------------------------------------- the cells

type Cell = { where: string; node: ReactNode } | { none: string }
type Two = [Cell, Cell]

/** The box with a voice note in it, where you are (a toast over it, when one says what happened): on the desktop's
 * New input page its Draft card over the list, as the page passes it. */
function inBox(at: '' | 'F012', note: Partial<DraftFile>, text = '', heard?: HeardFile[], said?: string): Two {
  const draw = (desk: boolean) => {
    // the item's note is the one its talk plays (0:12)
    const files = [{ ...VOICE, ...(at ? { ms: 12_000 } : {}), ...note, ...(heard ? heard[0] : {}) }]
    // the phone shows the words to pick from in the box by itself; the desktop's item box needs Show the words
    const box = boxAt({ at, text, files, ...(heard ? { heard: { showing: !desk } } : {}) }, desk)
    const top = said ? toastOver(said) : null
    if (at || !desk) return <>{top}{box}</>
    // the Draft card's hint, as the page works it out: the words still to check, else its words can be corrected
    const open = heard ? new Set(spotsIn(text, heard).filter((p) => !p.x.pick).map((p) => `${p.fk} ${p.k}`)).size : 0
    const hint: DraftHint = open ? { kind: 'check', n: open } : text ? { kind: 'fix' } : null
    const words = text ? <LiveWords text={text} heard={heard ?? [{ key: VOICE.key, trAdded: text, doubts: [] }]} className={DRAFT_WORDS} /> : null
    const card = <DraftCard voice={1} ms={VOICE.ms ?? 0} files={0} state={notesState(files)} words={words} hint={hint} />
    return (
      <>
        {top}
        {box}
        <div className="px-3 pb-3">{saidOf({ inputs: [], draft: card })}</div>
      </>
    )
  }
  return [
    { where: at ? 'the box' : 'the box, its Draft card under it', node: draw(true) },
    { where: 'the box', node: draw(false) },
  ]
}

/** The New input after sending: the desktop lists it under the box; the phone says it in the line over the box (T689). */
function sentNew(f: { mine?: Outgoing[]; sent?: Input; busy?: boolean }): Two {
  const s: Said = { inputs: f.sent ? [f.sent] : [], outbox: f.mine, busy: f.busy ? f.sent?.id : undefined }
  return [
    { where: 'the list under the box', node: <>{boxAt({ at: '' }, true)}<div className="px-3 pb-6">{saidOf(s)}</div></> },
    { where: 'the line over the box', node: <><div className="[&>div]:pb-0">{sentLine({ mine: f.mine, sent: f.sent }, false)}</div>{boxAt({ at: '' }, false)}</> },
  ]
}

/** The New input's box, and the desktop's list under it, as `s` has them (the phone's own list is its Inputs tab). */
const newBoxAnd = (h: Here, s: Said, said?: string): Two => [
  { where: 'the box, the list under it', node: <>{said ? toastOver(said) : null}{boxAt(h, true)}<div className="px-3 pb-6">{saidOf(s)}</div></> },
  { where: 'the box', node: <>{said ? toastOver(said) : null}{boxAt(h, false)}</> },
]

/** The item's box (F012), as `h` has it. */
const itemBox = (h: Here, said?: { text: string; action?: string }): Two =>
  [true, false].map((desk) => ({ where: 'the box', node: <>{said ? toastOver(said.text, said.action) : null}{boxAt({ at: 'F012', ...h }, desk)}</> })) as Two

/** The item's talk (F012), its messages and the inputs they came from. */
const inTalk = (thread: Message[], o: Parameters<typeof talkOf>[2] = {}, f: Partial<Item> = {}): Two =>
  [true, false].map((desk) => ({ where: 'its talk', node: talkOf(item({ n: 12, thread, ...f }), desk, { inputs: [r4()], ...o }) })) as Two

/** What you sent from the item, on its way: the faded bubble under the message before it. */
const replyGoing = (state: 'Sending…' | 'Waiting for Taska…' | 'Not sent', words: string) =>
  inTalk([ASKED], { t: { outgoing: [{ ...out(state).t.outgoing[0], text: words, voices: [voice] }] } })

const none = (why: string): Two => [{ none: why }, { none: why }]

// ---------------------------------------------------------------- the rows

/** The sections, the normal ways first (T722). */
const SECTIONS = {
  normal: { title: 'Normal: the words are final before you send', where: 'In the box first; once sent, the New input list (desktop), the line over the box (phone), the talk (item).' },
  early: { title: 'Normal: sent before the words were final', where: 'Sent with the fast words: the New input list (desktop), the line over the box (phone), the talk (item).' },
  outcomes: { title: 'Other outcomes', where: 'The New input list (desktop), the line over the box (phone), the talk (item).' },
  words: { title: 'Word branches', where: 'In the box, before sending.' },
  sending: { title: 'Sending and organizing branches', where: 'The New input list (desktop), the line over the box (phone), the talk (item).' },
  later: { title: 'Later changes', where: 'The New input list (desktop), the box and the Inputs tab (phone), the box and the talk (item).' },
} as const

interface Row {
  section: keyof typeof SECTIONS
  /** the state's own name (model/voiceStates) when not given */
  label?: string
  /** how long, or what else to know, in a few words */
  note?: string
  /** New input · desktop, New input · phone, In an item · desktop, In an item · phone */
  cells: [...Two, ...Two]
}

/** The toast the page shows when a message in `from` goes on `on` (model/voiceStates). */
const toast = (from: VoiceState, on: VoiceEvent) => VOICE_STEPS.find((x) => x.from === from && x.on === on)?.toast

/** Each state of a voice message (model/voiceStates) drawn in the four places: one row, or one per way into it that
 * looks different. A new state has no row here until it is drawn: the types say so. */
const ROWS: Record<VoiceState, Row[]> = {
  recording: [
    {
      section: 'normal',
      cells: [
        { where: 'the box', node: boxAt({ rec: true }, true) },
        { where: 'the box', node: boxAt({ rec: true }, false) },
        ...itemBox({ rec: true }),
      ],
    },
  ],
  uploading: [{ section: 'normal', note: 'shows as transcribing', cells: [...inBox('', { f: '', uploading: true, transcript: 'wait' }), ...inBox('F012', { f: '', uploading: true, transcript: 'wait' })] }],
  transcribing: [{ section: 'normal', note: 'both models start', cells: [...inBox('', { transcript: 'wait' }), ...inBox('F012', { transcript: 'wait' })] }],
  fastWords: [{ section: 'normal', note: 'about 2 s', cells: [...inBox('', { transcript: 'fast' }, N1_FAST), ...inBox('F012', { transcript: 'fast' }, I1_FAST)] }],
  words: [
    {
      section: 'normal',
      label: 'Strong words replace them',
      note: 'with a toast',
      cells: [...inBox('', {}, N1, undefined, toast('fastWords', 'strong')), ...inBox('F012', {}, I1, undefined, toast('fastWords', 'strong'))],
    },
    { section: 'words', label: 'Maybe misheard', note: 'first words final', cells: [...inBox('', {}, HEARD_TEXT, HEARD), ...inBox('F012', {}, AGAIN, AGAIN_HEARD)] },
    { section: 'words', label: 'Strong model failed', note: 'fast words kept', cells: [...inBox('', {}, N1_FAST), ...inBox('F012', {}, I1_FAST)] },
  ],
  noWords: [
    {
      section: 'words',
      cells: [...inBox('', { transcript: 'none' }, '', undefined, toast('transcribing', 'nothing')), ...inBox('F012', { transcript: 'none' }, '', undefined, toast('transcribing', 'nothing'))],
    },
  ],
  wordsFailed: [
    {
      section: 'words',
      cells: [...inBox('', { transcript: 'failed' }, '', undefined, toast('transcribing', 'failed')), ...inBox('F012', { transcript: 'failed' }, '', undefined, toast('transcribing', 'failed'))],
    },
  ],
  uploadFailed: [
    {
      section: 'words',
      cells: [...inBox('', { f: '', failed: true }, '', undefined, toast('uploading', 'uploadRefused')), ...inBox('F012', { f: '', failed: true }, '', undefined, toast('uploading', 'uploadRefused'))],
    },
  ],
  sending: [{ section: 'normal', cells: [...sentNew({ mine: [GOING] }), ...replyGoing('Sending…', I1)] }],
  offline: [{ section: 'sending', note: 'offline', cells: [...sentNew({ mine: [{ ...GOING, state: 'failed', net: true }] }), ...replyGoing('Waiting for Taska…', I1)] }],
  notSent: [{ section: 'sending', cells: [...sentNew({ mine: [{ ...GOING, state: 'failed' }] }), ...replyGoing('Not sent', I1)] }],
  sentTranscribing: [
    {
      section: 'early',
      note: 'sent while both models work',
      cells: [...sentNew({ sent: SENT_BARE }), ...inTalk([ASKED, you('')], { inputs: [r4({ text: '', files: [{ ...NOTE_R4, voice: waiting(NOTE_R4.f) }] })] })],
    },
  ],
  sentFastWords: [
    {
      section: 'early',
      note: 'strong model still working',
      cells: [...sentNew({ sent: EARLY }), ...inTalk([ASKED, you(I2_FAST)], { inputs: [r4({ text: '', files: [{ ...NOTE_R4, voice: waiting(NOTE_R4.f, I2_FAST) }] })] })],
    },
  ],
  organizing: [
    { section: 'normal', cells: [...sentNew({ sent: ORGANIZING, busy: true }), ...none('Not shown here: the talk stays as sent')] },
    { section: 'early', label: 'Strong words swap in, organizing', note: 'silently', cells: [...sentNew({ sent: SWAPPED, busy: true }), ...inTalk([ASKED, you(I2)], { inputs: [r4Said(I2, voice.heard)] })] },
  ],
  created: [
    { section: 'normal', cells: [...sentNew({ sent: MADE }), ...inTalk([ASKED, you(I1)], { inputs: [MADE_HERE], others: [PHONE_BUG] })] },
    {
      section: 'later',
      label: 'Edited after sending',
      note: 'read again, then as before',
      cells: [
        ...sentNew({ sent: EDITED }).slice(0, 1),
        { where: 'the Inputs tab', node: cardOf(EDITED) },
        ...inTalk([ASKED, you(I2_EDITED, { edited: later(3) })], { inputs: [r4Said(I2_EDITED, voice.heard, { history: [{ text: I2, t: T, mode: 'edit' }], updated: later(3) })] }),
      ] as [...Two, ...Two],
    },
  ],
  added: [{ section: 'early', cells: [...sentNew({ sent: ADDED }), ...none('Nothing more: said here, it is in this item')] }],
  forAgent: [{ section: 'outcomes', cells: [...sentNew({ sent: LEFT }), ...none('Not shown here: the talk stays as sent')] }],
  handled: [
    {
      section: 'outcomes',
      cells: [...sentNew({ sent: HANDLED }), ...inTalk([ASKED, you(I2)], { inputs: [r4Said(I2, voice.heard)] }, { readBy: { 'claude-code': Date.parse(later(0)) + 30_000 } })],
    },
  ],
  organizeFailed: [{ section: 'sending', cells: [...sentNew({ sent: NOT_ORGANIZED }), ...none('Not shown here: the talk stays as sent')] }],
  cancelled: [
    {
      section: 'sending',
      note: 'Esc',
      cells: [
        ...newBoxAnd({ at: '' }, { inputs: [{ ...ONE.cancelled, t: T }] }, 'Recording cancelled · kept in New input').map((c, i) => (i ? { where: 'the box', node: <>{toastOver('Recording cancelled · kept in Inputs')}{boxAt({ at: '' }, false)}</> } : c)),
        ...itemBox({}, { text: 'Recording discarded', action: 'Undo' }),
      ] as [...Two, ...Two],
    },
  ],
  adding: [
    {
      section: 'later',
      cells: [
        { where: 'its row in the list', node: <>{boxAt({ at: '' }, true)}<div className="px-3 pb-6">{saidOf({ inputs: [MADE], adding: { id: MADE.id, clock: '0:04' } })}</div></> },
        { where: 'the box', node: boxAt({ at: '', mode: { kind: 'amend', id: MADE.id, mode: 'append', v: 0 }, inputs: [MADE], rec: true }, false) },
        ...itemBox({ mode: { kind: 'amend', id: 'r4', mode: 'append', v: 0 }, inputs: [r4Said(I2, voice.heard, { scope: 12 })], rec: true }),
      ],
    },
  ],
}

// ---------------------------------------------------------------- the page

const COLUMNS = [
  { title: 'New input · desktop', w: DESK, layout: 'desk' as const },
  { title: 'New input · phone', w: PHONE, layout: 'phone' as const },
  { title: 'In an item · desktop', w: DESK, layout: 'desk' as const },
  { title: 'In an item · phone', w: PHONE, layout: 'phone' as const },
]
const LABEL = 'w-44 shrink-0'

function Place({ cell, col }: { cell: Cell; col: (typeof COLUMNS)[number] }) {
  if ('none' in cell)
    return (
      <div style={{ width: col.w }} className="flex shrink-0 flex-col gap-1">
        <span className="font-sans text-xs text-zinc-500">{col.title}</span>
        <p className="m-0 rounded-md border border-dashed border-zinc-300 px-3 py-4 font-sans text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">{cell.none}</p>
      </div>
    )
  return (
    <div className="shrink-0">
      <Frame layout={col.layout} width={col.w} label={`${col.title} · ${cell.where}`}>
        {cell.node}
      </Frame>
    </div>
  )
}

const Step = ({ head, children, tone = 'zinc' }: { head: string; children?: ReactNode; tone?: 'zinc' | 'amber' | 'emerald' | 'blue' }) => (
  <div
    className={`w-44 rounded-lg border px-3 py-2 font-sans ${
      { zinc: 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950', amber: 'border-amber-300 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-400/10', emerald: 'border-emerald-300 bg-emerald-50 dark:border-emerald-400/40 dark:bg-emerald-400/10', blue: 'border-blue-300 bg-blue-50 dark:border-blue-400/40 dark:bg-blue-400/10' }[tone]
    }`}
  >
    <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{head}</div>
    {children ? <div className="mt-0.5 text-xs leading-snug text-zinc-600 dark:text-zinc-300">{children}</div> : null}
  </div>
)
const Arrow = () => <span className="shrink-0 font-sans text-lg text-zinc-400">→</span>

/** How a voice note's words are worked out, and where sending and the organizer come in. */
function Flow() {
  return (
    <section aria-label="How it works" className="flex items-center gap-3 rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900">
      <Step head="Record">Stop, or send while recording</Step>
      <Arrow />
      <div className="flex flex-col gap-2">
        <Step head="Fast model" tone="amber">
          First words in about 2 s: “{sayIn('fastWords', 'chip')?.say}”
        </Step>
        <Step head="Strong model" tone="emerald">
          At the same time; up to 3 tries × 30 s
        </Step>
      </div>
      <Arrow />
      <Step head="Final words" tone="emerald">
        The strong words replace the fast ones; if it fails, the fast words stay
      </Step>
      <Arrow />
      <Step head="Send" tone="blue">
        Any time, also before the final words; they swap in after
      </Step>
      <Arrow />
      <Step head="Organizer">Waits for the final words, 150 s at most</Step>
      <Arrow />
      <Step head="What it became">Created B014, Added to F012, For an agent, Handled</Step>
    </section>
  )
}

/** Every state of a voice message, in four places: the normal ways first (words final before sending; sent before),
 * then the other outcomes, the branches of its words, of sending and organizing, and changes after sending. */
export const WholeWorkflow: Story = {
  name: 'Whole workflow',
  render: () => {
    let n = 0
    return (
      <div className="flex w-max flex-col gap-6 bg-zinc-200 p-6 dark:bg-zinc-800">
        <Flow />
        {/* the places, over the rows as the page scrolls */}
        <div className="sticky top-0 z-10 -my-3 flex gap-6 bg-zinc-200 px-4 py-3 font-sans text-base font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
          <span className={LABEL} />
          {COLUMNS.map((c, i) => (
            <h2 key={c.title} style={{ width: c.w }} className={`m-0 shrink-0 text-base ${i === 2 ? 'ml-6' : ''}`}>
              {c.title}
            </h2>
          ))}
        </div>
        {(Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]).map((key, k) => (
          <section key={key} aria-label={SECTIONS[key].title} className="flex flex-col gap-3">
            <header className="font-sans">
              <h2 className="m-0 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {k + 1}. {SECTIONS[key].title}
              </h2>
              <p className="m-0 mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">{SECTIONS[key].where}</p>
            </header>
            {VOICE_STATE_LIST.flatMap((state) => ROWS[state].filter((r) => r.section === key).map((r) => ({ state, r }))).map(({ state, r }) => (
              <div key={`${state} ${r.label ?? ''}`} aria-label={r.label ?? VOICE_STATES[state].label} className="flex items-start gap-6 rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900">
                <h3 className={`${LABEL} m-0 font-sans text-sm font-semibold text-zinc-700 dark:text-zinc-200`}>
                  <span className="mr-1.5 text-zinc-400 tabular-nums">{++n}</span>
                  {r.label ?? VOICE_STATES[state].label}
                  {r.note ? <span className="mt-0.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">{r.note}</span> : null}
                  <code className="mt-1 block text-[11px] font-normal text-zinc-400">{state}</code>
                </h3>
                {r.cells.map((c, i) => (
                  <div key={COLUMNS[i].title} className={i === 2 ? 'ml-6' : ''}>
                    <Place cell={c} col={COLUMNS[i]} />
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
    )
  },
}
