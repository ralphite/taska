// T550 (r767): Input box > Commenting on a document: the box through the whole flow of a comment on a document, with
// the document around it (in the item pane on the desktop, in its sheet on the phone), from nothing picked to what is
// left once the comment is sent, failed or waits for Taska.
// B555: each story is the real page with the document open (/p/shop/D1), after what Yadong does there (a pick, Aa,
// the mic, its check, Send, Reply, a tick); the comment goes to the real Taska server in the page, or Taska answers
// as the story says (still on its way, refused, out of reach); the speech model is Storybook's stand-in.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { place } from '../../lib/onpage'
import type { Do, Twin } from '../../lib/twin'

const meta: Meta = { title: 'Components/Input box/Commenting on a document' }
export default meta
type Story = StoryObj

// the demo's documents: D1 the export plan (F01), D2 a web page (I04), D4 the Spanish plan (T09: choices to tick)
const PLAN = 1,
  PAGE = 2,
  TICKS = 4
const SAID = '\u8fd9\u91cc\u5199\u6e05\u695a\uff1aA \u4e0a\u7ebf\u540e\u591a\u4e45\u505a B\uff1f', // say when B follows once A is out
  REPLY = '\u540c\u610f\uff0c\u5148\u505a A\u3002' // agreed, A first
const DOC = { d: ['#detailView', '#foot'], p: '#overlay' }
/** Document `d` open, then these steps; `taska`: how Taska answers a comment (op "dc"). */
const flow = (
  steps: Do[],
  more: Partial<Twin> & { d?: number; taska?: 'on its way' | 'refused' | 'out of reach' } = {},
  on?: 'phone',
): Story => {
  const { d = PLAN, taska, ...rest } = more
  const net = taska
    ? { '^/p/shop/api/op': ({ 'on its way': 'hang', refused: 'no', 'out of reach': 'down' } as const)[taska] }
    : undefined
  return place({ at: `/p/shop/D${d}`, part: DOC, steps, ...(net ? { net } : {}), ...rest }, on)
}
const SEC = (i: number) => `#docBlocks > section:nth-child(${i})`
/** Pick a paragraph: Comment beside it on the desktop (B340: reading never picks; a second one adds), a tap on the
 * phone. */
const pick = (i: number): Do[] => [
  { point: SEC(i), on: 'd' },
  { click: `${SEC(i)} [data-act="doc-pick"]`, on: 'd' },
  { click: SEC(i), on: 'p' },
]
/** The phone: Aa under the picked part (type instead of speaking): the box comes under the document. */
const aa: Do = { click: '[data-act="doc-type"]', on: 'p' }
const write = (text: string): Do => ({ type: text, into: '#text' })
const mic: Do = { click: '#sendBtn[data-act="mic"]' }
const stop: Do = { click: '[data-act="rec-stop"]' } // the check: the words go into the box
const send: Do = { click: '#sendBtn[data-act="send"]' }
const pause = (ms: number): Do => ({ wait: ms })
/** The conclusion's thread, opened from its count, then Reply in it. */
const openThread: Do = {
  click: `${SEC(2)} [data-act="doc-thread"], [data-act="doc-thread"][data-key^="d7291783ec#"]`,
}
const reply: Do = { click: '[data-act="doc-reply"]' }
/** A choice of the Spanish plan ticked. */
const tick = (i: number): Do => ({ click: `[data-act="doc-tick"][data-d="4"][data-i="${i}"]` })

// ---------------------------------------------------------------- while commenting
/** The document open, nothing picked: on the desktop the box is a reply to its item (B340, no line); on the phone no
 * box until you tap a part, Aa or Comment on the whole document. */
export const NothingPicked = flow([], { live: false })
/** The phone: Comment on the whole document: the box comes under the sheet, its line says so, Reply to F01 beside. */
export const WholeDocument = flow([{ click: '[data-act="doc-whole"]' }], { live: false }, 'phone')
/** One paragraph picked: the box's line says Comment on D1 and its words; on the phone the part's own mic and Aa
 * under it, the box not there yet. */
export const OnePicked = flow(pick(2), { live: false })
/** The phone: Aa under the picked part: the box comes, its line the same as on the desktop. */
export const OnePickedAa = flow([...pick(2), aa], { live: false }, 'phone')
/** Two paragraphs picked (the phone picks more than one once the box is there). */
export const SeveralPicked = flow([...pick(2), aa, ...pick(4)], { live: false })
/** Picked, and words typed: Send says Comment. */
export const PickedTyping = flow([...pick(2), aa, write(SAID)], { live: false })
/** Picked, recording with the box's mic: the line still says where it goes. */
export const PickedRecording = flow([...pick(2), aa, mic, pause(3000)], { live: false })
/** Picked, the recording stopped with its check: its words are being worked out (the speech model at work). */
export const PickedTranscribing = flow([...pick(2), aa, mic, pause(2500), stop, pause(1200)], {
  live: true,
  heard: { working: true },
})
/** Picked, the voice note's words in the box, ready to send. */
export const PickedVoiceWords = flow([...pick(2), aa, mic, pause(2500), stop, pause(2500)], { live: true })
/** The phone's own way to speak about a part: the mic under it records, the same button stops and posts (B300). */
export const PickedSpeakingOnThePhone = flow(
  [...pick(2), { click: '[data-act="doc-say"]' }, pause(3000)],
  { live: false },
  'phone',
)

// ---------------------------------------------------------------- sending, sent, not sent
const typed: Do[] = [...pick(2), aa, write(SAID), send]
/** Comment pressed, Taska has not answered yet: the comment is on its paragraph at once (its thread open), the box
 * empty and its pick gone (T274 #3). */
export const Sending = flow([...typed, pause(600)], { taska: 'on its way' })
/** Taska took it: what the box and the document show once it is saved. */
export const Sent = flow([...typed, pause(1500)])
/** Taska out of reach: the comment stays on its paragraph and is sent again by itself until Taska answers. */
export const SentWhileOutOfReach = flow([...typed, pause(2500)], { taska: 'out of reach' })
/** Taska said no (the document was deleted meanwhile): the words come back into the box, Not saved in the top bar. */
export const NotSent = flow([...typed, pause(1500)], { taska: 'refused' })
/** A voice note's words, sent as a comment. */
export const VoiceCommentSent = flow([...pick(2), aa, mic, pause(2500), stop, pause(2500), send, pause(1500)], {
  live: true,
})

// ---------------------------------------------------------------- replying, choices, a web page
/** A thread opened from its count, Reply in it (the box comes with it on the phone too), words typed. */
export const ReplyingInAThread = flow([openThread, reply, write(REPLY)], { live: false })
/** The reply sent: it is in the thread; the box is the document's again. */
export const ReplySent = flow([openThread, reply, write(REPLY), send, pause(1500)])
/** Choices ticked, not sent (B524): the line says how many, with its own Send choices; the round button stays the mic. */
export const ChoicesTicked = flow([tick(0), tick(1)], { d: TICKS, live: false })
/** Choices ticked, then a paragraph picked: the box comments on the paragraph; the choices wait (on the phone the box
 * is already there, for the choices). */
export const ChoicesTickedAndAPick = flow([tick(0), tick(1), ...pick(2), write(SAID)], { d: TICKS, live: false })
/** A web page (F432): a part picked in Comment mode (the row of three cards, in the page's own frame), words typed. */
const CARDS = '#detailView iframe, #dlg iframe >>> main > div:nth-child(2)'
const partPicked: Do[] = [{ click: '[data-act="doc-inspect"]', on: 'd' }, { click: CARDS }, aa]
export const WebPagePartPicked = flow([...partPicked, write(SAID)], { d: PAGE, live: false })
/** The web page comment sent: the part has its count. */
export const WebPageCommentSent = flow([...partPicked, write(SAID), send, pause(1500)], { d: PAGE })
