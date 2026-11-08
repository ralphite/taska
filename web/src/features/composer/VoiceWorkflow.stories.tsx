// A voice message from start to end, on one page (T722): each state a band, in the order you meet them, the New input
// and a reply in an item side by side, each on the phone and the desktop. Every cell is drawn as the state's own story
// draws it (the box, the line after sending, the New input page's list, the item's talk), with the same fixtures.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { spotsIn, type HeardFile } from '../../model/doubts'
import type { Input, Item } from '../../model/types'
import { Frame, type FrameProps } from '../../stories/Frames'
import { REC, VOICE, boxAt, out as outgoing, sentLine } from '../../stories/boxFixtures'
import { org } from '../../stories/composerSentFixtures'
import { HEARD, HEARD_TEXT } from '../../stories/doubtFixtures'
import { AGAIN, AGAIN_HEARD, LiveWords } from '../../stories/doubtsFixtures'
import { input, item, message, record, shown, waiting } from '../../stories/fixtures'
import { later, mine, out, r4, voice } from '../../stories/fromYouFixtures'
import { ONE, saidOf } from '../../stories/inputFixtures'
import { talkOf } from '../../stories/itemPage'
import { DraftCard, DRAFT_WORDS, type DraftHint } from './DraftCard'
import type { DraftFile } from './DraftFiles'

export default { title: 'UI/Input box/Voice/Whole workflow' } satisfies Meta
type Story = StoryObj
type Layout = FrameProps['layout']

const DESK = 640

// ---- a new input: what is said, and the note it is said into
const SAID = ONE.made.text
const EARLY = 'The coupon box hides behind the keyboard'
const SAID_AS_HEARD = 'So the coupon box, um, it hides behind the keyboard on the phone.'
const NOTE = { f: VOICE.f, name: VOICE.name, mime: VOICE.mime }
/** an input said by voice alone: its words its note's (B682) */
const spoken = (r: Input, said = r.text): Input => shown({ ...r, text: '', files: [NOTE] }, record(NOTE.f, r.text, said))

/** The box with a voice note in it, where you are: on the desktop's New input page its Draft card over the list. */
const box = (at: '' | 'F012', note: Partial<DraftFile>, text = '', heard?: HeardFile[]) => (layout: Layout) => {
  const files = [{ ...VOICE, ...note, ...(heard ? heard[0] : {}) }]
  const inBox = boxAt({ at, text, files, ...(heard ? { heard: at ? { showing: true } : {} } : {}) }, layout === 'desk')
  if (at || layout === 'phone') return inBox
  // the card's hint, as the page works it out: the words still to check, else its words can be corrected
  const open = heard ? new Set(spotsIn(text, heard).filter((p) => !p.x.pick).map((p) => `${p.fk} ${p.k}`)).size : 0
  const hint: DraftHint = open ? { kind: 'check', n: open } : text ? { kind: 'fix' } : null
  const words = text ? <LiveWords text={text} heard={heard ?? [{ key: VOICE.key, trAdded: text, doubts: [] }]} className={DRAFT_WORDS} /> : null
  const card = <DraftCard voice={1} ms={VOICE.ms ?? 0} files={0} transcribing={!!note.transcribing} words={words} hint={hint} />
  return (
    <>
      {inBox}
      <div className="px-3 pb-3">{saidOf({ inputs: [], draft: card })}</div>
    </>
  )
}

/** Recording a new input: on the desktop's New input page it also comes first in the list (B627). */
const recNew = (layout: Layout) =>
  layout === 'phone' ? (
    boxAt({ rec: true }, false)
  ) : (
    <>
      {boxAt({ rec: true }, true)}
      <div className="px-3 pb-3">{saidOf({ inputs: [], recording: REC.time })}</div>
    </>
  )

/** After sending: the phone's line over the box (T689); the desktop's New input page lists it under its box. */
const sentNew = (f: { mine?: ReturnType<typeof outgoing>[]; sent?: Input; busy?: boolean }) => (layout: Layout) =>
  layout === 'phone' ? (
    sentLine({ mine: f.mine, sent: f.sent }, false)
  ) : (
    <>
      {boxAt({ at: '' }, true)}
      <div className="px-3 pb-6">{saidOf({ inputs: f.sent ? [f.sent] : [], outbox: f.mine, busy: f.busy ? f.sent?.id : undefined })}</div>
    </>
  )
const GOING = outgoing({ text: '', files: [NOTE], words: { [NOTE.f]: SAID } })
const TRANSCRIBING = shown(input({ id: 'r25', text: '', files: [NOTE] }), waiting(NOTE.f))
const ORGANIZING = spoken(input({ id: 'r25', text: SAID }), SAID_AS_HEARD)
const MADE = spoken(ONE.made, SAID_AS_HEARD)
const LEFT = spoken(ONE.left, 'Look at, hmm, why the build takes so long.')
const HANDLED = spoken(ONE.handled, 'Look at, hmm, why the build takes so long.')

// ---- a reply in an item (F012): what is said, and the talk it goes into
const REPLY = voice.tr
const REPLY_EARLY = 'The export should keep the filter'
const ASKED = message({ id: 1, by: 'claude-code', kind: 'say', text: 'Which filter should the export keep?' })
const talk = (thread = [mine()], o: Parameters<typeof talkOf>[2] = {}, f: Partial<Item> = {}) => (layout: Layout) =>
  talkOf(item({ n: 12, thread, ...f }), layout === 'desk', { inputs: [r4()], ...o })
/** on its way, or not sent: the voice note in the faded bubble under the message before it */
const replyGoing = (state: 'Sending…' | 'Not sent') => talk([ASKED], { t: { outgoing: [{ ...out(state).t.outgoing[0], text: REPLY, voices: [voice] }] } })
// B714 #10594: words said here that the organizer made into a new item
const ALSO = 'The export should keep the filter I set. Also, on the phone the Export button does nothing at all.'
const PHONE_BUG = item({ n: 14, type: 'bug', pri: 'P1', title: 'Export does nothing on the phone', srcs: ['r4'], t0: later(1), body: ALSO })
const MADE_HERE = r4({
  text: ALSO,
  files: [{ f: voice.f, name: voice.name, mime: voice.mime, voice: record(voice.f, ALSO, 'The export should keep the filter I set. And also, um, on the phone the Export button does nothing at all.') }],
  scope: 12,
  touched: [14],
  acked: true,
  org: { ...org(true, 'Created B014'), t: later(1) },
})

type Cell = ((layout: Layout) => ReactNode) | string
interface Row {
  label: string
  /** the New input, then the reply in an item; words: nothing of its own there (the cell says why) */
  cells: [Cell, Cell]
}

const ROWS: Row[] = [
  { label: 'Recording', cells: [recNew, (l) => boxAt({ at: 'F012', rec: true }, l === 'desk')] },
  { label: 'Writing it out', cells: [box('', { tr: '', transcribing: true }), box('F012', { tr: '', transcribing: true })] },
  { label: 'Early words, more coming', cells: [box('', { tr: EARLY, more: true }, EARLY), box('F012', { tr: REPLY_EARLY, more: true }, REPLY_EARLY)] },
  { label: 'Final words, tidied', cells: [box('', { tr: SAID }, SAID), box('F012', { tr: REPLY }, REPLY)] },
  { label: 'Maybe misheard: pick one', cells: [box('', { tr: HEARD_TEXT }, HEARD_TEXT, HEARD), box('F012', { tr: AGAIN }, AGAIN, AGAIN_HEARD)] },
  { label: 'Nothing heard', cells: [box('', { tr: '' }), box('F012', { tr: '' })] },
  { label: 'Writing it out failed', cells: [box('', { tr: '', trError: 'Gemini HTTP 503' }), box('F012', { tr: '', trError: 'Gemini HTTP 503' })] },
  { label: 'Sent, on its way', cells: [sentNew({ mine: [GOING] }), replyGoing('Sending…')] },
  { label: 'Not sent: Retry', cells: [sentNew({ mine: [{ ...GOING, state: 'failed' }] }), replyGoing('Not sent')] },
  {
    label: 'Being written out',
    cells: [sentNew({ sent: TRANSCRIBING }), talk([mine({ text: '' })], { inputs: [r4({ text: '', files: [{ ...NOTE, f: voice.f, name: voice.name, voice: waiting(voice.f) }] })] })],
  },
  { label: 'Being organized', cells: [sentNew({ sent: ORGANIZING, busy: true }), talk([mine()], { inputs: [r4({ files: [voice] })] })] },
  { label: 'Made an item', cells: [sentNew({ sent: MADE }), talk([mine({ text: ALSO })], { inputs: [MADE_HERE], others: [PHONE_BUG] })] },
  { label: 'Added to an item', cells: [sentNew({ sent: ONE.voice }), 'Said in this item: its talk stays as above'] },
  { label: 'For the agent', cells: [sentNew({ sent: LEFT }), 'Its talk stays as above until the agent reads it'] },
  {
    label: 'Handled by the agent',
    cells: [sentNew({ sent: HANDLED }), talk([mine()], { inputs: [r4({ files: [voice] })] }, { readBy: { 'claude-code': Date.parse(later(0)) + 30_000 } })],
  },
]

const COLUMNS = ['New input', 'Reply in an item']

function Pair({ cell, where }: { cell: Cell; where: string }) {
  if (typeof cell === 'string') return <p className="m-0 w-[1049px] self-center font-sans text-sm text-zinc-500 dark:text-zinc-400">{cell}</p>
  return (
    <div className="flex items-start gap-4">
      <Frame layout="phone" label={`${where} · phone`}>
        {cell('phone')}
      </Frame>
      <Frame layout="desk" width={DESK} label={`${where} · desktop`}>
        {cell('desk')}
      </Frame>
    </div>
  )
}

/** Every state of a voice message in order: recording, its words written out (or not), sent, handled, and what it
 * became; the New input on the left, a reply in an item (F012) on the right. */
export const WholeWorkflow: Story = {
  name: 'Whole workflow',
  render: () => (
    <div className="flex w-max flex-col gap-4 bg-zinc-200 p-6 dark:bg-zinc-800">
      <div className="flex gap-10 pl-[200px] font-sans text-base font-semibold text-zinc-800 dark:text-zinc-100">
        {COLUMNS.map((c) => (
          <h2 key={c} className="m-0 w-[1049px] text-base">
            {c}
          </h2>
        ))}
      </div>
      {ROWS.map((r, i) => (
        <section key={r.label} aria-label={r.label} className="flex gap-6 rounded-xl bg-zinc-100 p-4 dark:bg-zinc-900">
          <h3 className="m-0 w-40 shrink-0 font-sans text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            <span className="mr-1.5 text-zinc-400 tabular-nums">{i + 1}</span>
            {r.label}
          </h3>
          <div className="flex gap-10">
            {r.cells.map((c, k) => (
              <Pair key={COLUMNS[k]} cell={c} where={COLUMNS[k]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
}
