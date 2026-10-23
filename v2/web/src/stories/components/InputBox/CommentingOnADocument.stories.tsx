// T550 (r767): Input box > Commenting on a document: the box through the whole flow of a comment on a document, with
// the document around it (in the item pane on the desktop, in its sheet on the phone), from nothing picked to what is
// left once the comment is sent, failed or waits for Taska. Each story opens the document as the page leaves it
// (lib/docs.ts openDoc), then does what Yadong does with the page's own actions (lib/actions.ts ACT: pick, Aa, the mic,
// its check, Send, Reply, a tick), so the box, the line on top of it and the document are the page's own.
// What Taska answers is the only thing a story sets: a save that is still on its way, taken, refused, or Taska out of
// reach; a voice note taken, its words still being worked out or heard (beforeEach below, in this story's frame only).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VcBar } from '../../../components/Composer'
import { Toast } from '../../../components/Shell'
import { ACT } from '../../../lib/actions'
import { SAVE } from '../../../lib/data'
import { clearTicks, tickKeys } from '../../../lib/doctick'
import { syncDraft } from '../../../lib/drafts'
import { followBox } from '../../../lib/events'
import { OV, U, desk, els, model, threadKey } from '../../../lib/state'
import type { Doc } from '../../../lib/types'
import { single, type Platform } from '../../lib/both'
import { Column } from '../../lib/column'
import type { Setup } from '../../lib/demo'

const meta: Meta = { title: 'Components/Input box/Commenting on a document' }
export default meta
type Story = StoryObj

// ---------------------------------------------------------------- the demo's documents and words
const PLAN = '\u5bfc\u51fa\u65b9\u6848', // the export plan (D1 on F01): a title, the conclusion, a list of two, steps, a table, a quote
  TICKS = '\u897f\u73ed\u7259\u8bed', // the Spanish plan (D4): choices to tick
  PAGE = '\u6df1\u8272' // the dark mode preview (D2): a web page
const SAID = '\u8fd9\u91cc\u5199\u6e05\u695a\uff1aA \u4e0a\u7ebf\u540e\u591a\u4e45\u505a B\uff1f', // say when B follows once A is out
  VOICE =
    '\u65b9\u6848 A \u5148\u4e0a\u7ebf\uff0cB \u653e\u5230\u4e0b\u5468\uff0c\u8bb0\u5f97\u544a\u8bc9\u5ba2\u670d\u3002', // what the voice note says (the speech model's words)
  REPLY = '\u540c\u610f\uff0c\u5148\u505a A\u3002' // agreed, A first
// the row of three cards in the demo web page, and what it says (as WebPage.tsx picks a part: key "h:<its place>")
const ROW = 'h:body>main:nth-child(1)>div:nth-child(2)',
  ROW_TEXT = 'Revenue $48,210 Orders 1,284 Avg. order $37.55'

// ---------------------------------------------------------------- what Taska answers
/** What Taska does with what the page sends while the story plays:
 * - op: a document comment (op "dc"): still on its way, taken, refused (it says why), or Taska out of reach
 * - voice: a voice note goes up and its words are worked out (still working, or these words). */
interface Answers {
  op?: 'on its way' | 'taken' | 'refused' | 'out of reach'
  voice?: 'working' | string
}
const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } })
const never = () => new Promise<Response>(() => {})
/** Taska's answers, put in front of the stand-in for Taska (.storybook/public/app-shim.js) while the story plays. A
 * comment it took is in the document the next time the page asks for the project, as Taska's store keeps it
 * (server/taska/store.py "dc"): its own thread, its id the next one. */
function answering(a: Answers) {
  const before = window.fetch
  const taken: Record<string, unknown>[] = []
  window.fetch = async (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href)
    const post = String(init?.method || 'GET').toUpperCase() === 'POST'
    if (post && u.pathname.endsWith('/api/file') && a.voice) return json({ f: 'f3-voice_0-07.webm', size: 15245 }) // a demo voice note, so the box can play it
    if (post && u.pathname.endsWith('/api/transcript') && a.voice)
      return a.voice === 'working' ? never() : json({ done: true, tr: a.voice, tr_error: '', doubts: [] })
    if (post && u.pathname.endsWith('/api/op') && a.op) {
      const o = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>
      if (o.op === 'dc') {
        if (a.op === 'on its way') return never()
        if (a.op === 'out of reach') throw new TypeError('Failed to fetch')
        if (a.op === 'refused') return json({ ok: false, res: ['err: that paragraph is not in the document'] })
        taken.push(o)
        return json({ ok: true, res: [`ok D${String(o.d)} comment`], rev: 2 })
      }
    }
    const r = await before(input, init)
    if (!taken.length || !/\/api\/state$/.test(u.pathname)) return r
    const S = (await r.json()) as { docs: Doc[] }
    for (const o of taken) {
      const d = S.docs.find((x) => x.d === o.d)
      if (!d) continue
      const id = 9000 + taken.indexOf(o),
        key = String(o.key)
      const c = {
        id,
        key,
        th: Number(o.th) || id,
        quote: String(o.quote ?? d.blocks.find((b) => b.key === key)?.text ?? ''),
        text: String(o.text),
        by: 'you',
        t: new Date().toISOString(),
        files: (o.files as Doc['comments'][number]['files']) || [], // a voice comment keeps its recording (F184)
      }
      d.comments.push(c)
      const b = d.blocks.find((x) => x.key === key)
      if (b) b.comments.push(c)
      else if (key === 'doc') d.whole.push(c)
      else d.blocks.push({ key, kind: 'para', text: c.quote, comments: [c] }) // F432: a new part of a page
      if (!o.th) d.open += 1
    }
    return json(S)
  }
  return () => {
    window.fetch = before
  }
}

// ---------------------------------------------------------------- what Yadong does, the page's way
type Step = () => unknown
const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms))
const cur = () => model.S.docs.find((d) => d.d === U.doc) as Doc
const blk = (i: number) => cur().blocks[i]
/** Pick a paragraph: Comment beside it on the desktop (B340: reading never picks; a second one adds), a tap on the
 * phone. */
const pick =
  (i: number): Step =>
  () =>
    ACT['doc-pick']({ key: blk(i).key, ...(desk() ? { pickBtn: '1' } : {}) })
/** The phone: Aa under the picked part (type instead of speaking): the box comes under the document. */
const aa: Step = () => (desk() ? undefined : ACT['doc-type']({}))
/** Words typed into the box (its own input handler takes them, as from the keyboard). */
const write =
  (text: string): Step =>
  () => {
    const t = els.text
    if (!t) return
    t.value = text
    t.dispatchEvent(new Event('input', { bubbles: true }))
  }
const mic: Step = () => ACT.mic({})
const stop: Step = () => ACT['rec-stop']({}) // the check: the words go into the box
const send: Step = () => ACT.send({})
const pause =
  (ms: number): Step =>
  () =>
    wait(ms)
/** The conclusion's thread, opened from its count, then Reply in it. */
const thread = () => threadKey(blk(1).comments[0])
const openThread: Step = () => ACT['doc-thread']({ key: thread() })
const reply: Step = () => ACT['doc-reply']({ key: thread() })
/** A choice of the Spanish plan ticked (the list of four, its i-th line). */
const tick =
  (i: number): Step =>
  () =>
    ACT['doc-tick']({ d: String(U.doc), key: tickKeys(cur())[2].k, i: String(i) })

// ---------------------------------------------------------------- a story: the document open, then the steps
interface Flow {
  doc?: string
  platform?: Platform
  taska?: Answers
  setup?: (x: Setup, d: Doc) => void
  steps?: Step[]
}
/** The document open as openDoc leaves it: over its item; on the phone in its sheet, with no box under it until you
 * type (I285: U.docType, from a draft or ticks waiting). */
function opened(x: Setup, title: string) {
  SAVE.last = JSON.stringify(x.S) // what the page last had from Taska, as load() keeps it: a change Taska refused goes back to it
  const d = x.S.docs.find((d) => d.title.startsWith(title)) as Doc
  clearTicks(d.d)
  U.open = d.n
  U.doc = d.d
  U.docType = false
  if (!desk()) OV.spec = { kind: 'doc', props: { d: d.d }, focus: false, tall: true, aboveComposer: false }
  syncDraft() // the box's draft is the document's, as the page has it before every redraw (lib/boot.ts)
  return d
}
const flow = (f: Flow): Story => ({
  parameters: {
    ...(f.platform ? { platform: f.platform } : {}),
    taska: {
      setup: (x) => {
        const d = opened(x, f.doc || PLAN)
        f.setup?.(x, d)
      },
    },
  },
  beforeEach: () => answering(f.taska || {}),
  // the page's toast too: what it says when a comment is not saved (lib/toast.ts addFailed)
  render: () => (
    <div className="relative h-screen">
      <Column />
      <VcBar />
      <Toast />
    </div>
  ),
  play: async () => {
    // only in the frame that draws the story (the desktop and the phone are each drawn in a frame of their own)
    if (!single()) return
    followBox() // the sheet follows the box as it grows, as the page wires it (lib/events.ts)
    await wait(900) // the page has drawn and is still
    for (const s of f.steps || []) {
      await s()
      await wait(350)
    }
  },
})

// ---------------------------------------------------------------- while commenting
/** The document open, nothing picked: on the desktop the box is a reply to its item (B340, no line); on the phone no
 * box until you tap a part, Aa or Comment on the whole document. */
export const NothingPicked = flow({})
/** The phone: Comment on the whole document: the box comes under the sheet, its line says so, Reply to F01 beside. */
export const WholeDocument = flow({ platform: 'phone', steps: [() => ACT['doc-whole']({})] })
/** One paragraph picked: the box's line says Comment on D1 and its words; on the phone the part's own mic and Aa
 * under it, the box not there yet. */
export const OnePicked = flow({ steps: [pick(1)] })
/** The phone: Aa under the picked part: the box comes, its line the same as on the desktop. */
export const OnePickedAa = flow({ platform: 'phone', steps: [pick(1), aa] })
/** Two paragraphs picked (the phone picks more than one once the box is there). */
export const SeveralPicked = flow({ steps: [pick(1), aa, pick(3)] })
/** Picked, and words typed: Send says Comment. */
export const PickedTyping = flow({ steps: [pick(1), aa, write(SAID)] })
/** Picked, recording with the box's mic: the line still says where it goes. */
export const PickedRecording = flow({ taska: { voice: 'working' }, steps: [pick(1), aa, mic, pause(3000)] })
/** Picked, the recording stopped with its check: its words are being worked out. */
export const PickedTranscribing = flow({
  taska: { voice: 'working' },
  steps: [pick(1), aa, mic, pause(2500), stop, pause(1200)],
})
/** Picked, the voice note's words in the box, ready to send. */
export const PickedVoiceWords = flow({
  taska: { voice: VOICE },
  steps: [pick(1), aa, mic, pause(2500), stop, pause(1500)],
})
/** The phone's own way to speak about a part: the mic under it records, the same button stops and posts (B300). */
export const PickedSpeakingOnThePhone = flow({
  platform: 'phone',
  taska: { voice: 'working' },
  steps: [pick(1), () => ACT['doc-say']({ key: blk(1).key }), pause(3000)],
})

// ---------------------------------------------------------------- sending, sent, not sent
/** Comment pressed, Taska has not answered yet: the comment is on its paragraph at once (its thread open), the box
 * empty and its pick gone (T274 #3). */
export const Sending = flow({ taska: { op: 'on its way' }, steps: [pick(1), aa, write(SAID), send, pause(600)] })
/** Taska took it: what the box and the document show once it is saved. */
export const Sent = flow({ taska: { op: 'taken' }, steps: [pick(1), aa, write(SAID), send, pause(1500)] })
/** Taska out of reach: the comment stays on its paragraph and is sent again by itself until Taska answers. */
export const SentWhileOutOfReach = flow({
  taska: { op: 'out of reach' },
  steps: [pick(1), aa, write(SAID), send, pause(2500)],
})
/** Taska said no (the paragraph changed meanwhile): the words come back into the box, Not saved in the top bar. */
export const NotSent = flow({ taska: { op: 'refused' }, steps: [pick(1), aa, write(SAID), send, pause(1500)] })
/** A voice note's words, sent as a comment. */
export const VoiceCommentSent = flow({
  taska: { voice: VOICE, op: 'taken' },
  steps: [pick(1), aa, mic, pause(2500), stop, pause(1500), send, pause(1500)],
})

// ---------------------------------------------------------------- replying, choices, a web page
/** A thread opened from its count, Reply in it, words typed. */
export const ReplyingInAThread = flow({ steps: [openThread, reply, aa, write(REPLY)] })
/** The reply sent: it is in the thread; the box is the document's again. */
export const ReplySent = flow({
  taska: { op: 'taken' },
  steps: [openThread, reply, aa, write(REPLY), send, pause(1500)],
})
/** Choices ticked, not sent (B524): the line says how many, with its own Send choices; the round button stays the mic. */
export const ChoicesTicked = flow({ doc: TICKS, steps: [tick(0), tick(1)] })
/** Choices ticked, then a paragraph picked: the box comments on the paragraph; the choices wait. */
export const ChoicesTickedAndAPick = flow({ doc: TICKS, steps: [tick(0), tick(1), pick(1), aa, write(SAID)] })
/** A web page (F432): a part picked in Comment mode, words typed. The part is picked as WebPage.tsx picks it (a click
 * inside the page, which a story cannot make). */
const partPicked = () => {
  U.docInspect = desk()
  U.docQuote = { key: ROW, text: ROW_TEXT }
}
export const WebPagePartPicked = flow({ doc: PAGE, setup: partPicked, steps: [aa, write(SAID)] })
/** The web page comment sent: the part has its count. */
export const WebPageCommentSent = flow({
  doc: PAGE,
  setup: partPicked,
  taska: { op: 'taken' },
  steps: [aa, write(SAID), send, pause(1500)],
})
