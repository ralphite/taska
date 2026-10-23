// T457, T512: the one input box (R108) in every state it has: what you write in it, voice notes, what it writes to (the
// line on top), pictures and files, and the line above it that says what happened to what you sent. Its stories are
// in the folders beside this file.
// B555: each story is the real page after Yadong's steps (typing, the mic, a paste, Send; the speech model and the
// organizer answering on the real Taska server in the page), showing the box where the page has it: the foot of the
// item pane (desktop) or of the screen (phone) in an item; the New input page on the desktop, under the list on the
// phone, for a new input.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { place } from '../../lib/onpage'
import type { Do, Twin } from '../../lib/twin'
import { W } from '../../demo/words'

// what this part of Storybook shows
export const area: Meta = {
  parameters: {
    covers: [
      'Composer',
      'BoxHomeSlot',
      'BoxInner',
      'TextArea',
      'BoxBtn',
      'ScopeLine',
      'ScopeLink',
      'ScopeX',
      'DraftFiles',
      'Doubts',
      'RecBar',
      'RecTime',
      'Feedback',
      'Link',
      'Dismiss',
      'Foot',
    ],
  },
}
export type Story = StoryObj

const SHOP = '/p/shop/'
const BOX = '#foot'
/** The box at `ref` (an item: a reply to it; the project: a new input), after these steps. */
const box = (ref: string, steps?: Do[], more: Partial<Twin> = {}, on?: 'desktop' | 'phone'): Story =>
  place({ at: SHOP + ref, part: BOX, steps, live: false, ...more }, on)
/** The box with the pointer on one of its buttons (desktop): the button as under the pointer, with the page's tip. */
const pointing = (ref: string, at: string, steps?: Do[], more: Partial<Twin> = {}): Story =>
  box(ref, steps, { part: [BOX, '#tip'], hover: at, ...more }, 'desktop')

// ---------------------------------------------------------------- the words, the files, the steps
const SAID =
  '\u8ba2\u5355\u9875\u5217\u8868\u5f88\u957f\u7684\u65f6\u5019\u6eda\u52a8\u5f88\u5361\uff0c\u5927\u6982 2,000 \u5355\u4ee5\u4e0a\u5c31\u5f00\u59cb\u5361\u4e86\u3002'
const LONG =
  SAID +
  '\n\u6211\u5728 iPhone \u548c MacBook \u4e0a\u90fd\u8bd5\u4e86\uff0cSafari \u548c Chrome \u90fd\u4e00\u6837\u3002\n\u7b5b\u9009\u4e86\u201c\u5df2\u4ed8\u6b3e\u201d\u4e4b\u540e\u5c31\u4e0d\u5361\u4e86\uff0c\u6240\u4ee5\u5e94\u8be5\u662f\u884c\u6570\u592a\u591a\u3002\n\u80fd\u4e0d\u80fd\u5148\u53ea\u663e\u793a 200 \u884c\uff0c\u5f80\u4e0b\u6eda\u518d\u52a0\u8f7d\uff1f\u53e6\u5916\u6eda\u52a8\u7684\u65f6\u5019\u987a\u4fbf\u770b\u4e00\u4e0b\u662f\u4e0d\u662f\u56fe\u7247\u592a\u5927\u3002'
// longer than the box is tall: it scrolls
const LONGER =
  LONG +
  '\n\u8fd8\u6709\u5bfc\u51fa\u4e5f\u5f88\u6162\uff0c\u4e00\u4e07\u884c\u8981\u7b49\u534a\u5206\u949f\u3002\n\u624b\u673a\u4e0a\u66f4\u6162\uff0c\u6709\u65f6\u5019\u76f4\u63a5\u767d\u5c4f\u3002\n\u4e0a\u5468\u4e94\u5f00\u59cb\u7684\uff0c\u4e4b\u524d\u6ca1\u6709\u8fd9\u4e2a\u95ee\u9898\u3002\n\u4f1a\u4e0d\u4f1a\u662f\u90a3\u6b21\u6539\u5217\u8868\u6837\u5f0f\u5f15\u8d77\u7684\uff1f'
const write = (words: string): Do => ({ type: words, into: '#text' })
const send: Do = { click: '#sendBtn[data-act="send"]' }
const SHOT = (f: string) => `/storybook/fixtures/p__shop__f__${f}`
const PICS = ['f2-shot-checkout.png', 'f4-shot-cart.png', 'f5-shot-cart2.png', 'f6-shot-orders.png'].map(SHOT)
/** The box's mic (the round button while the box is empty), held for a few seconds of speech (the microphone is
 * Storybook's stand-in, saying the demo's sentence). */
const speak: Do[] = [{ click: '#sendBtn[data-act="mic"]' }, { wait: 2500 }]
/** The check: the recording stops and its words go into the box, once the speech model has them. */
const stop: Do = { click: '[data-act="rec-stop"]' }
const hearing: Do = { wait: 2500 }
/** What the speech model may have misheard (the demo's sentence: one word both models heard differently). */
const MISHEARD = { was: W.doubtWas, alt: W.doubtAlt, why: W.doubtWhy }
const OP = '^/p/shop/api/op',
  FILE = '^/p/shop/api/file',
  TRANSCRIPT = '^/p/shop/api/transcript'

// ---------------------------------------------------------------- Writing
/** Nothing written: the round button is the mic. */
export const Empty = box('')
/** A few words: Send takes the mic's place, a small mic beside it. */
export const Words = box('', [write(SAID)])
/** Many lines: the box grows with them; on the desktop the words take its whole width, the buttons a row under them. */
export const ManyLines = box('', [write(LONG)])
/** More than the box holds: it stops growing and scrolls. */
export const TooLongForTheBox = box('', [write(LONGER)])
export const PointingAtTheMic = pointing('', '#sendBtn')
export const PointingAtSend = pointing('', '#sendBtn', [write(SAID)])
export const PointingAtAdd = pointing('', '#attachBtn')
/** T522 (r731): the box you are writing in (its field focused): its edge a shade darker. */
export const BoxFocused = box('', [{ click: '#text' }])
export const BoxFocusedWithWords = box('', [write(SAID)])

// ---------------------------------------------------------------- Voice (in F01)
/** Recording: x drops it, the time and how loud you speak, the check puts its words in the box, the arrow sends it. */
export const Recording = box('F1', [{ click: '#sendBtn[data-act="mic"]' }, { wait: 3000 }])
export const RecordingPointingAtTheCheck = pointing('F1', '#micBtn', [
  { click: '#sendBtn[data-act="mic"]' },
  { wait: 3000 },
])
/** Stopped: its words are being worked out (the speech model at work). */
export const VoiceTranscribing = box('F1', [...speak, stop, { wait: 1000 }], { live: true, heard: { working: true } })
/** Taska could not be reached while it worked out the words: it tries again by itself. */
export const VoiceRetrying = box('F1', [...speak, stop, { wait: 1500 }], { net: { [TRANSCRIPT]: 'down' } })
export const VoiceWithWords = box('F1', [...speak, stop, hearing], { live: true })
/** Words came before the whole note was heard: the rest follow. */
export const VoiceCutShort = box('F1', [...speak, stop, hearing], { live: true, heard: { more: true } })
export const VoiceNoWords = box('F1', [...speak, stop, hearing], { live: true, heard: { tr: '' } })
/** The speech model failed, again on each of the page's tries: no words. */
export const VoiceFailed = box('F1', [...speak, stop, { wait: 24000 }], {
  live: true,
  heard: { fails: 'The words could not be worked out' },
})
/** The two speech models heard a word differently: said under the voice note (desktop); on the phone, the words to
 * check, shown on a tap. */
const doubts: Partial<Twin> = { live: true, heard: { doubts: [MISHEARD] } }
export const VoiceDoubts = box('F1', [...speak, stop, hearing], doubts)
/** The phone, the other version picked (the box shows the words with each doubtful one as its two versions, as soon
 * as they come): it is in the box now, ticked. */
export const VoiceOtherPicked = box(
  'F1',
  [...speak, stop, hearing, { click: '[data-act="doubt-pick"][data-side="alt"]' }],
  doubts,
  'phone',
)
/** A word only one model was unsure of, with nothing else heard (the desktop; the phone does not mark it). */
export const VoiceUnsure = box(
  'F1',
  [...speak, stop, hearing],
  { live: true, heard: { doubts: [{ was: W.doubtWas, alt: '', why: 'unsure', unsure: true }] } },
  'desktop',
)
/** On the New input page (desktop) the doubtful words are picked in the draft under the box. */
export const VoiceDoubtsOnNewInputPage = box('', [...speak, stop, hearing], doubts, 'desktop')

// ---------------------------------------------------------------- What it writes to
/** A new input: on the desktop the New input page, the box under the project's name and what you said lately under
 * it; on the phone the box under the list. No line on top: its words say it. */
export const NewInput = box('')
export const NewInputWithWords = box('', [write(SAID)])
/** A reply to an item: the box at the foot of the item (on the phone its talk runs on under the box, seen around its
 * top corners, F478); no line on top, its words say "Reply to". */
export const ReplyToAnItem = box('F1')
export const ReplyToAnItemWithWords = box('F1', [write(SAID)])
// F01's document (D1) open: in its pane on the desktop; on the phone in a sheet, the box under it once you type (Aa)
const SEC = (i: number) => `#docBlocks > section:nth-child(${i})`
const pick = (i: number): Do[] => [
  { point: SEC(i), on: 'd' },
  { click: `${SEC(i)} [data-act="doc-pick"]`, on: 'd' },
  { click: SEC(i), on: 'p' },
]
const aa: Do = { click: '[data-act="doc-type"]', on: 'p' }
const thread: Do = { click: `${SEC(2)} [data-act="doc-thread"], [data-act="doc-thread"][data-key^="d7291783ec#"]` }
export const CommentOnAParagraph = box('D1', [...pick(2), aa])
export const CommentOnParagraphs = box('D1', [...pick(2), aa, ...pick(4)])
export const ReplyInAThread = box('D1', [thread, { click: '[data-act="doc-reply"]' }])
/** A document open with nothing in it picked: a reply to its item on the desktop (B340), with no line (the phone has
 * no box until you pick or type). */
export const DocumentNothingPicked = box('D1', undefined, {}, 'desktop')
/** Voice comments said on two paragraphs (each one's own mic, stopped), waiting in the box: Send posts each beside its
 * paragraph (F184). The desktop: on the phone the same button posts at once. */
const sayOn = (i: number): Do[] => [
  { point: SEC(i), on: 'd' },
  { click: `${SEC(i)} [data-act="doc-say"]` },
  { wait: 2500 },
  { click: `${SEC(i)} [data-act="doc-say"]` },
  hearing,
]
export const CommentsNotSent = box('D1', [...sayOn(2), ...sayOn(4)], { live: true }, 'desktop')
/** Editing your comment on a document (its Edit in its open thread): its words in the box, Save. */
export const EditingYourComment = box('D1', [
  thread,
  { point: '[data-dc="23"]', on: 'd' },
  { click: '[data-act="dc-edit"][data-id="23"]' },
])
/** Editing an input you sent (#4, in F01's talk): its words in the box, Save. */
const r4 = (what: string): Do[] => [
  { click: '#itemTalk [data-mid="40"] [data-act="input-more"][data-id="r4"]' },
  { click: `#dlgBody [data-act="input-pick"][data-pick="${what}"]` },
]
export const EditingAnInput = box('F1', r4('input-edit'))
export const AddingToAnInput = box('F1', r4('input-append'))
/** Correcting words a voice note got wrong (F204): the wrong word selected in what you said (#20, the phone's Inputs),
 * Correct, the right words, remembered for every project (the desktop's New input page offers no Correct). */
const R20 = '[data-voice="r20"]'
export const CorrectingAWord = box(
  '',
  [{ click: '#tabs [data-tab="inputs"]' }, { select: 'Export', in: R20 }, { click: '#fixBtn' }, write('\u5bfc\u51fa')],
  {},
  'phone',
)
/** Still recording for F01 while B02 is open: the recording goes to F01 when you stop (B1). */
export const RecordingForAnotherItem = box('F1', [
  { click: '#sendBtn[data-act="mic"]' },
  { wait: 1500 },
  { click: '#backBtn', on: 'p' },
  { click: '#list [data-act="open"][data-n="2"]' },
  { wait: 1500 },
])

// ---------------------------------------------------------------- Pictures and files (in F01)
const paste = (n: number): Do[] => Array.from({ length: n }, (_, i) => ({ paste: PICS[i % PICS.length] }))
export const WithPictures = box('F1', [...paste(2), write('\u89c1\u622a\u56fe')])
/** A picture still going up: faded until Taska has it. */
export const PictureUploading = box('F1', paste(1), { net: { [FILE]: 'hang' } })
/** A file that is not a picture (one of the demo's saved answers, views.json). */
export const AFile = box('F1', [{ paste: '/storybook/fixtures/api__views.json' }])
/** More than the box is wide: they scroll sideways. */
export const ManyPictures = box('F1', paste(9))

// ---------------------------------------------------------------- Line after sending (phone)
/** The box under the list on the phone, where the line about what you sent shows (on the desktop the New input page
 * lists what you sent, and an item its thread), after a new input is sent. */
const NEW =
  '\u7ed3\u8d26\u9875\u7684\u4f18\u60e0\u5238\u8f93\u5165\u6846\u5728\u624b\u673a\u4e0a\u88ab\u952e\u76d8\u6321\u4f4f\u4e86\u3002'
const sent = (steps: Do[], more: Partial<Twin> = {}): Story =>
  box('', steps, { live: true, still: true, ...more }, 'phone')
const said: Do[] = [write(NEW), send]
/** The first ten seconds after Send, Undo takes it back. */
export const Sending = sent(said, { net: { [OP]: 'hang' }, live: false })
export const UploadingThenSending = sent([{ paste: PICS[0] }, ...said], { net: { [FILE]: 'hang' }, live: false })
export const SeveralOnTheirWay = sent([...said, write(SAID), send, write('\u89c1\u622a\u56fe'), send], {
  net: { [OP]: 'hang' },
  live: false,
})
/** Taska out of reach: it goes by itself the moment Taska answers. */
export const WaitingForTaska = sent(said, { net: { [OP]: 'down' }, live: false })
/** Taska has it: what became of it. */
export const SentWaiting = sent(said)
export const SentLeftForYourAgent = sent([...said, { organize: 'pass' }])
export const SentTranscribing = sent([...speak, { click: '#sendBtn[data-act="rec-send"]' }, { wait: 1000 }], {
  heard: { working: true },
})
export const OrganizerFailed = sent([...said, { organize: 'B99 say \u4f18\u60e0\u5238\u8f93\u5165\u6846' }])
/** Filed: what was made of it, to look at or undo. */
const filed: Do = { organize: 'new bug P1 now \u4f18\u60e0\u5238\u8f93\u5165\u6846\u88ab\u952e\u76d8\u6321\u4f4f' }
export const Filed = sent([...said, filed])
/** Your agent took it without making an item. */
export const SeenNoItem = sent([...said, { agent: 'ack r22' }])
