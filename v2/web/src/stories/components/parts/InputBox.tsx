// T457, T512: the one input box (R108) in every state it has: what you write in it, voice notes, what it writes to (the
// line on top), pictures and files, and the line above it that says what happened to what you sent. Writing shows the
// box where you write a new input (the New input page on the desktop, under the list on the phone), with the page
// around it; the states inside the box show the box alone, at its home at the foot of the pane (the page's own foot),
// in an item (F01) so the desktop and the phone show the same. Its stories are in the folders beside this file.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useLayoutEffect } from 'react'
import { Composer } from '../../../components/Composer'
import { Foot, Tip } from '../../../components/Shell'
import { deskPanes, deskPlace } from '../../../layouts/DeskLayout'
import { phonePanes } from '../../../layouts/PhoneLayout'
import { tipShow } from '../../../lib/events'
import { plainQuote } from '../../../lib/markdown'
import {
  OV,
  R_STATE,
  U,
  bump,
  desk,
  els,
  model,
  threadKey,
  useArea,
  type DraftFile,
  type Job,
} from '../../../lib/state'
import type { Input } from '../../../lib/types'
import { levelOf } from '../../../lib/voice'
import { Pane, type Setup } from '../../lib/demo'
import { Column } from '../../lib/column'

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

// ---------------------------------------------------------------- how a story draws the box
/** The box alone, at its home: the foot of the item pane (desktop) or of the screen (phone), as the page draws it.
 * The words are put in the box as typing leaves them, not kept as a draft (a story leaves nothing behind). */
function Box({ text = '' }: { text?: string }) {
  useArea('detail')
  useLayoutEffect(() => {
    if (els.text && text) els.text.value = text
    bump('composer', 'feedback')
  }, [text])
  return (
    <Pane w={desk() ? 'item' : 'full'}>
      <Foot hidden={(desk() ? deskPanes() : phonePanes()).v.foot} place={desk() ? deskPlace().foot : ''} />
      <Composer />
    </Pane>
  )
}
const F1 = (x: Setup) => (U.open = x.it('F1').n)
/** The box in F01: what you write there is a reply to it, on the desktop and the phone alike. */
const box = (text = '', setup?: (x: Setup) => void, platform?: 'desktop' | 'phone'): Story => ({
  parameters: { ...(platform ? { platform } : {}), taska: { setup: (x) => (F1(x), setup?.(x)) } },
  render: () => <Box text={text} />,
})
/** The box with the page around it (the column it lives in): with nothing open, where a new input is written (the New
 * input page on the desktop, under the list on the phone); with an item open, at the item's foot. */
const page = (text = '', setup?: (x: Setup) => void, platform?: 'desktop' | 'phone'): Story => ({
  parameters: { ...(platform ? { platform } : {}), taska: { setup } },
  render: () => <Column text={text} />,
})
/** Pointing at one of the box's buttons (desktop): the button as under the pointer, with the page's own tip. */
function Pointing({ at, text = '' }: { at: string; text?: string }) {
  useEffect(() => {
    // once the column has settled (lib/column.tsx), as pointing at it shows it (lib/events.ts)
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(at)
      if (el) tipShow(el, true)
    }, 1300)
    return () => clearTimeout(t)
  }, [at])
  return (
    <>
      <Column text={text} />
      <Tip />
    </>
  )
}
const pointing = (at: string, text = '', setup?: (x: Setup) => void): Story => ({
  parameters: { platform: 'desktop', pseudo: { hover: [at] }, taska: { setup } },
  render: () => <Pointing at={at} text={text} />,
})

// ---------------------------------------------------------------- the demo's words and files
const done = Promise.resolve()
const pictures = () => model.S.inputs.flatMap((r) => r.files).filter((x) => x.mime?.startsWith('image/'))
const shot = (i: number): DraftFile => {
  const f = pictures()[i]
  return { ...f, mime: f.mime || 'image/png', done, size: 48213 }
}
/** A picture still going up: drawn from the picture you picked, faded until Taska has it. */
const going = (i: number): DraftFile => {
  const f = shot(i)
  return { ...f, preview: `/p/shop/f/${encodeURIComponent(f.f || '')}`, f: undefined }
}
const voice = (extra: Partial<DraftFile> = {}): DraftFile => {
  const f = model.S.inputs.flatMap((r) => r.files).find((x) => x.mime?.startsWith('audio/'))!
  return { ...f, mime: f.mime || 'audio/webm', done, ms: 23000, ...extra }
}
const SAID =
  '\u8ba2\u5355\u9875\u5217\u8868\u5f88\u957f\u7684\u65f6\u5019\u6eda\u52a8\u5f88\u5361\uff0c\u5927\u6982 2,000 \u5355\u4ee5\u4e0a\u5c31\u5f00\u59cb\u5361\u4e86\u3002'
const LONG =
  SAID +
  '\n\u6211\u5728 iPhone \u548c MacBook \u4e0a\u90fd\u8bd5\u4e86\uff0cSafari \u548c Chrome \u90fd\u4e00\u6837\u3002\n\u7b5b\u9009\u4e86\u201c\u5df2\u4ed8\u6b3e\u201d\u4e4b\u540e\u5c31\u4e0d\u5361\u4e86\uff0c\u6240\u4ee5\u5e94\u8be5\u662f\u884c\u6570\u592a\u591a\u3002\n\u80fd\u4e0d\u80fd\u5148\u53ea\u663e\u793a 200 \u884c\uff0c\u5f80\u4e0b\u6eda\u518d\u52a0\u8f7d\uff1f\u53e6\u5916\u6eda\u52a8\u7684\u65f6\u5019\u987a\u4fbf\u770b\u4e00\u4e0b\u662f\u4e0d\u662f\u56fe\u7247\u592a\u5927\u3002'
// longer than the box is tall: it scrolls
const LONGER =
  LONG +
  '\n\u8fd8\u6709\u5bfc\u51fa\u4e5f\u5f88\u6162\uff0c\u4e00\u4e07\u884c\u8981\u7b49\u534a\u5206\u949f\u3002\n\u624b\u673a\u4e0a\u66f4\u6162\uff0c\u6709\u65f6\u5019\u76f4\u63a5\u767d\u5c4f\u3002\n\u4e0a\u5468\u4e94\u5f00\u59cb\u7684\uff0c\u4e4b\u524d\u6ca1\u6709\u8fd9\u4e2a\u95ee\u9898\u3002\n\u4f1a\u4e0d\u4f1a\u662f\u90a3\u6b21\u6539\u5217\u8868\u6837\u5f0f\u5f15\u8d77\u7684\uff1f'
const SAID_ALT = SAID.replace('2,000', '20,000') // what the other model heard
const MISHEARD = { was: '2,000', alt: '20,000', why: 'heard both' }

// ---------------------------------------------------------------- Writing
/** Nothing written: the round button is the mic. */
export const Empty = page()
/** A few words: Send takes the mic's place, a small mic beside it. */
export const Words = page(SAID)
/** Many lines: the box grows with them; on the desktop the words take its whole width, the buttons a row under them. */
export const ManyLines = page(LONG)
/** More than the box holds: it stops growing and scrolls. */
export const TooLongForTheBox = page(LONGER)
export const PointingAtTheMic = pointing('#sendBtn')
export const PointingAtSend = pointing('#sendBtn', SAID)
export const PointingAtAdd = pointing('#attachBtn')

// ---------------------------------------------------------------- Voice
/** Recording: x drops it, the time and how loud you speak, the check puts its words in the box, the arrow sends it. */
// B540: the meter as the page draws it 14 s into a note, from a real recording: the sentence Storybook's microphone
// plays (fixtures/mic.webm), measured every 100 ms the way the recorder measures (levelOf), the last 40 bars
const recording = async () => {
  const clip = await (await fetch('/storybook/fixtures/mic.webm')).arrayBuffer()
  const audio = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(clip)
  const samples = audio.getChannelData(0),
    step = audio.sampleRate / 10,
    bytes = new Uint8Array(512)
  const levels: number[] = []
  for (let at = 0; at + 512 < samples.length && levels.length < 140; at += step) {
    for (let i = 0; i < 512; i++) bytes[i] = Math.max(0, Math.min(255, Math.round(128 + 128 * samples[at + i])))
    levels.push(levelOf(bytes))
  }
  const silent = new AudioContext().createMediaStreamDestination().stream
  Object.assign(R_STATE, { rec: new MediaRecorder(silent), t0: Date.now() - 14000, levels: levels.slice(-40) })
}
export const Recording = box('', recording)
export const RecordingPointingAtTheCheck = pointing('#micBtn', '', recording)
export const VoiceTranscribing = box('', () => (U.files = [voice({ transcribing: true, tr: '' })]))
/** Taska could not be reached while it worked out the words: it tries again by itself. */
export const VoiceRetrying = box('', () => (U.files = [voice({ transcribing: true, retrying: true, tr: '' })]))
export const VoiceWithWords = box(SAID, () => (U.files = [voice({ tr: SAID, trAdded: SAID })]))
/** Words came before the whole note was heard: the rest follow. */
const START = SAID.slice(0, 12)
export const VoiceCutShort = box(START, () => (U.files = [voice({ tr: START, trAdded: START, more: true })]))
export const VoiceNoWords = box('', () => (U.files = [voice({ tr: '' })]))
export const VoiceFailed = box('', () => (U.files = [voice({ tr: '', tr_error: 'The words could not be worked out' })]))
/** The two speech models heard a word differently: said under the voice note (desktop); on the phone, the words to
 * check, shown on a tap. */
const doubt = () => (U.files = [voice({ tr: SAID, trAdded: SAID, doubts: [MISHEARD] })])
export const VoiceDoubts = box(SAID, doubt)
/** The phone, the words shown: each doubtful word as its two versions, the one in the box picked. */
export const VoiceDoubtsShown = box(SAID, () => (doubt(), (U.boxView = true)), 'phone')
/** The phone, the other version picked: it is in the box now, ticked. */
export const VoiceOtherPicked = box(
  SAID_ALT,
  () => {
    U.files = [voice({ tr: SAID, trAdded: SAID_ALT, doubts: [{ ...MISHEARD, pick: 'alt' }] })]
    U.boxView = true
  },
  'phone',
)
/** A word only one model was unsure of, with nothing else heard (the desktop; the phone does not mark it). */
export const VoiceUnsure = box(
  SAID,
  () =>
    (U.files = [voice({ tr: SAID, trAdded: SAID, doubts: [{ was: '2,000', alt: '', why: 'unsure', unsure: true }] })]),
  'desktop',
)
/** On the New input page (desktop) the doubtful words are picked in the draft under the box. */
export const VoiceDoubtsOnNewInputPage = page(SAID, doubt, 'desktop')
/** The mic on a page that is not https: why it cannot record, with Taska's secure link. */
export const VoiceNeedsSecureLink = box('', ({ S }) => {
  S.remote = 'https://taska.example.com'
  U.note = 'voice-why'
})
/** The same while Taska has no https link yet. */
export const VoiceNeedsHttps = box('', ({ S }) => {
  S.remote = ''
  U.note = 'voice-why'
})

// ---------------------------------------------------------------- What it writes to
/** A new input: on the desktop the New input page, the box under the project's name and what you said lately under
 * it; on the phone the box under the list. No line on top: its words say it. */
export const NewInput = page()
export const NewInputWithWords = page(SAID)
/** A reply to an item: the box at the foot of the item (on the phone its talk runs on under the box, seen around its
 * top corners, F478); no line on top, its words say "Reply to". */
export const ReplyToAnItem = page('', F1)
export const ReplyToAnItemWithWords = page(SAID, F1)
/** F01's document open: in its pane on the desktop; on the phone in a sheet, the box under it (Aa). */
const inDoc = (x: Setup) => {
  const d = x.S.docs.find((d) => d.n === x.it('F1').n)!
  U.open = d.n
  U.doc = d.d
  if (!desk()) {
    OV.spec = { kind: 'doc', props: { d: d.d }, focus: false, tall: true, aboveComposer: true }
    U.docType = true
  }
  return d
}
const doc = (setup: (x: Setup, d: ReturnType<typeof inDoc>) => void, text?: () => string): Story => ({
  parameters: { taska: { setup: (x) => setup(x, inDoc(x)) } },
  render: () => <Box text={text?.() || ''} />,
})
export const CommentOnAParagraph = doc((_, d) => (U.docSel = new Set([d.blocks[1].key])))
export const CommentOnParagraphs = doc((_, d) => (U.docSel = new Set([d.blocks[1].key, d.blocks[3].key])))
export const ReplyInAThread = doc((_, d) => (U.docReply = threadKey(d.comments.find((c) => c.key !== 'doc')!)))
/** A document open with nothing in it picked: on the phone a comment on the whole document; on the desktop a reply to
 * its item (B340), with no line. */
export const DocumentNothingPicked = doc(() => {})
/** Voice comments said on two paragraphs, waiting in the box: Send posts each beside its paragraph (F184). */
const quoted = () => {
  const d = model.S.docs.find((d) => d.d === U.doc)!
  // the words said about, as the page writes them into the box (lib/voice.ts vcQuote)
  return [d.blocks[1], d.blocks[3]].map((b) => ({ b, label: plainQuote(b.text.split('\n')[0]).replace(/\s+/g, ' ') }))
}
export const CommentsNotSent = doc(
  (_, d) => (U.vcMarks = quoted().map(({ b, label }) => ({ label, d: d.d, key: b.key, quote: b.text }))),
  () =>
    quoted()
      .map(({ label }, i) => `> \u201c${label}\u201d\n${i ? SAID : START}`)
      .join('\n\n'),
)
/** Editing your comment on a document: its words in the box, Save. */
export const EditingYourComment = doc(
  (_, d) => {
    const c = d.comments.find((c) => c.by === 'you')!
    U.amend = { mode: 'dc', d: d.d, id: c.id, was: c.text }
  },
  () => (U.amend?.mode === 'dc' ? U.amend.was : ''),
)
const unsent = (S: Input[]) => S.find((x) => !x.acked && x.files.some((f) => f.mime?.startsWith('image/')))!
/** Editing an input you sent: its words in the box, Save. */
export const EditingAnInput: Story = {
  parameters: {
    taska: {
      setup: ({ S }) => {
        const r = unsent(S.inputs)
        U.amend = { id: r.id, mode: 'edit', v: r.v || 0, base: r.text }
      },
    },
  },
  render: () => <Box text={U.amend && 'base' in U.amend ? U.amend.base : ''} />,
}
export const AddingToAnInput: Story = {
  parameters: {
    taska: {
      setup: ({ S }) => {
        const r = unsent(S.inputs)
        U.amend = { id: r.id, mode: 'append', v: r.v || 0 }
      },
    },
  },
  render: () => <Box />,
}
/** Correcting words a voice note got wrong (F204): the right words, remembered for every project. */
const WRONG = 'Export',
  RIGHT = '\u5bfc\u51fa'
export const CorrectingAWord: Story = {
  parameters: {
    taska: {
      setup: ({ S }) => {
        const r = S.inputs.find((x) => x.text.includes(WRONG) && x.files.some((f) => f.mime?.startsWith('audio/')))!
        U.correct = { id: r.id, wrong: WRONG, v: r.v || 0 }
      },
    },
  },
  render: () => <Box text={RIGHT} />,
}
/** Still recording for F01 while B02 is open: the recording goes to F01 when you stop (B1). */
export const RecordingForAnotherItem: Story = {
  parameters: {
    taska: {
      setup: ({ it }) => {
        U.open = it('B2').n
        recording()
        R_STATE.key = 'F01'
      },
    },
  },
  render: () => <Box />,
}

// ---------------------------------------------------------------- Pictures and files
export const WithPictures = box('\u89c1\u622a\u56fe', () => (U.files = [shot(0), shot(1)]))
export const PictureUploading = box('', () => (U.files = [going(0)]))
export const AFile = box('', () => {
  U.files = [{ name: 'orders-2026-10.csv', mime: 'text/csv', f: 'orders-2026-10.csv', done, size: 182044 }]
})
/** More than the box is wide: they scroll sideways. */
export const ManyPictures = box('', () => (U.files = [0, 1, 2, 3, 0, 1, 2, 3, 0].map(shot)))

// ---------------------------------------------------------------- Line after sending (phone)
/** The box under the list on the phone, where the line about what you sent shows (on the desktop the New input page
 * lists what you sent, and an item its thread). */
const below = (setup: (x: Setup) => void): Story => ({
  parameters: { platform: 'phone', taska: { setup } },
  render: () => <Box />,
})
const job = (q: string, extra: Partial<Job> = {}): Job => ({
  id: q,
  q,
  t: Date.now(),
  text: SAID,
  files: [],
  scope: null,
  p: '/p/shop/',
  ...extra,
})
/** The first ten seconds after Send, Undo takes it back (lib/outbox.ts). */
const undo = () => done
export const Sending = below(() => (U.outbox = [job('q1', { sending: true, undo })]))
export const UploadingThenSending = below(() => {
  U.outbox = [job('q1', { sending: true, undo, files: [going(0)] })]
})
export const SeveralOnTheirWay = below(() => {
  U.outbox = [job('q1', { sending: true }), job('q2', { text: LONG }), job('q3', { text: '\u89c1\u622a\u56fe' })]
})
export const NotSent = below(() => (U.outbox = [job('q1', { failed: true })]))
/** Taska out of reach: it goes by itself the moment Taska answers. */
export const WaitingForTaska = below(() => (U.outbox = [job('q1', { failed: true, net: true })]))
/** Taska has it: what became of it. A line that says it is done goes after six seconds, as on the page. */
const sent = (pick: (S: Input[]) => Input, change?: (r: Input) => void): Story =>
  below(({ S }) => {
    const r = pick(S.inputs)
    change?.(r)
    U.lastSent = r.id
  })
const written = (S: Input[]) => unsent(S)
const spoken = (S: Input[]) => S.find((x) => !x.acked && x.files.some((f) => f.mime?.startsWith('audio/')))!
const filed = (S: Input[]) => S.find((x) => x.org?.msg?.startsWith('Created'))!
export const SentWaiting = sent(written, (r) => (U.sentJobs = [job('q1', { rid: r.id, undo })]))
export const SentLeftForYourAgent = sent(written, (r) => {
  r.org = { ok: true, msg: 'Left for your coding agent', t: r.t, keep: true }
})
export const SentTranscribing = sent(spoken, (r) => (r.tr_wait = true))
export const SentOrganizing = sent(written, (r) => (model.S.org = { ...model.S.org, on: true, busy: r.id }))
export const OrganizerFailed = sent(written, (r) => {
  r.org = { ok: false, msg: 'Some commands failed: B99 not found', t: r.t, keep: false }
})
/** Filed: what was made of it, to look at or undo. */
export const Filed = sent(filed)
export const SeenNoItem = sent(written, (r) => {
  r.acked = true
  r.touched = []
})
export const MovedToAnotherProject = sent(written, (r) => (r.moved = { to: 'mobile-app', as: 'r4' }))
export const ChangesUndone = sent(filed, (r) => {
  if (r.org) r.org.undone = true
})
