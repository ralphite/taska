// T457: a document as you read it, comment on it and edit it: in the item pane on the desktop, in a sheet on the phone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Column } from '../../lib/column'
import { VcBar } from '../../../components/Composer'
import { OV, R_STATE, U, bump, desk, model, seenMap, threadKey } from '../../../lib/state'
import type { Comment, Doc } from '../../../lib/types'
import { clearTicks, tickDoc, tickKeys, tickModify } from '../../../lib/doctick'
import { docKey } from '../../../lib/docs'
import { DV } from '../../../lib/voice'
import { type Setup } from '../../lib/demo'
import type { Platform } from '../../lib/both'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'DocView',
      'DocEdit',
      'Outline',
      'Thread',
      'DcActs',
      'BlockActs',
      'Lasso',
      'DocHint',
      'DocMic',
      'NewDot',
      'PaneBtn',
      'DocPaneHead',
      'DocPaneActs',
      'DocPaneNav',
      'DraftCard',
      'WebPage',
      'SayRow',
      'VcBar',
    ],
  },
}
export type Story = StoryObj

const byTitle = (S: Setup['S'], t: string) => S.docs.find((d) => d.title.startsWith(t)) as Doc
/** The document open: in the item pane on the desktop, in its sheet on the phone. */
const doc = (title: string, setup?: (x: Setup, d: Doc) => void): Story => ({
  parameters: {
    taska: {
      setup: (x) => {
        const d = byTitle(x.S, title)
        U.open = d.n
        U.doc = d.d
        if (!desk()) OV.spec = { kind: 'doc', props: { d: d.d }, focus: false, tall: true }
        setup?.(x, d)
      },
    },
  },
  render: () => (
    <>
      <Column />
      <VcBar />
    </>
  ),
})
/** The same story, and: the one platform it is on (R520), the parts the pointer is on (storybook-addon-pseudo-states:
 * hover drawn without pointing, T522; in the story's globals too, so the addon has nothing to change and the story is
 * drawn once), words in the box, a step the user takes (taken again for a few seconds, for a page slow to draw). */
const also = (
  s: Story,
  x: { platform?: Platform; hover?: string[]; text?: string; step?: (page: Document) => void },
): Story => ({
  ...s,
  parameters: {
    ...s.parameters,
    ...(x.platform ? { platform: x.platform } : {}),
    ...(x.hover ? { pseudo: { hover: x.hover } } : {}),
  },
  ...(x.hover ? { globals: { pseudo: { hover: x.hover } } } : {}),
  ...(x.text
    ? {
        render: () => (
          <>
            <Column text={x.text} />
            <VcBar />
          </>
        ),
      }
    : {}),
  ...(x.step
    ? {
        play: async ({ canvasElement }) => {
          for (let i = 0; i < 12; i++) {
            await wait(300)
            x.step?.(canvasElement.ownerDocument)
          }
        },
      }
    : {}),
})
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString()
/** a paragraph of the document's text by its place (1: the title) */
const SEC = (i: number) => `#docBlocks > section:nth-child(${i})`
const PLAN = '\u5bfc\u51fa\u65b9\u6848', // the export plan: comments in three places
  LOAD = '\u538b\u6d4b', // the load test: long, with a table, code and a quote
  PAGE = '\u6df1\u8272', // a web page
  TICKS = '\u897f\u73ed\u7259' // choices to tick

/** Comments beside the paragraphs they are on (desktop), and one on the whole document. */
export const WithComments = doc(PLAN)
/** A long document starts with its contents. */
export const LongWithOutline = doc(LOAD)
/** A form: choices to tick, none ticked yet (no ticks of an earlier story left waiting in this browser). */
export const Checklist = doc(TICKS, (_, d) => clearTicks(d.d))
// two choices sent: they are in the document's text
const sent = (d: Doc) => {
  clearTicks(d.d)
  d.md = d.md
    .replace('- [ ] \u5546\u54c1\u9875', '- [x] \u5546\u54c1\u9875')
    .replace('- [ ] \u7ed3\u8d26', '- [x] \u7ed3\u8d26')
  d.blocks = d.blocks.map((b) => ({
    ...b,
    text: b.text.replace(/- \[ \] (\u5546\u54c1\u9875|\u7ed3\u8d26)/g, '- [x] $1'),
  }))
}
/** Sent: the ticks are in the document; the form is quieter, Submitted under it, Modify on hover (desktop). */
export const Sent = doc(TICKS, (_, d) => sent(d))
/** A web page document, shown as it is. */
export const WebPage = doc(PAGE)
/** Comment mode on a web page: pointing lights a part, a click picks it. */
export const WebPageCommentMode = doc(PAGE, () => (U.docInspect = true))
// the row of three cards in the demo web page, and what it says
const ROW = 'h:body>main:nth-child(1)>div:nth-child(2)',
  ROW_TEXT = 'Revenue $48,210 Orders 1,284 Avg. order $37.55'
/** A part of a web page picked (B497: no other part lights until Esc); on the phone, speak or type under it. */
export const WebPagePartPicked = doc(PAGE, () => {
  U.docInspect = desk()
  U.docQuote = { key: ROW, text: ROW_TEXT }
})
/** B498: speaking about a part: the mic you pressed is Stop, in place, and the time runs on the phone. */
export const WebPageRecording = doc(PAGE, (_, d) => {
  U.docInspect = desk()
  if (!desk()) U.docQuote = { key: ROW, text: ROW_TEXT }
  Object.assign(R_STATE, {
    rec: {} as MediaRecorder,
    t0: Date.now() - 6000,
    levels: Array.from({ length: 48 }, (_, i) => Math.abs(Math.sin(i / 3)) * 0.9),
    vc: {
      d: d.d,
      key: ROW,
      quote: ROW_TEXT,
      range: null,
      rect: { top: 0, bottom: 0, left: 0, width: 0, height: 0 },
      top: 0,
    },
  })
})
/** B503: a part's comments open under its count, the part outlined; a click anywhere else closes them. */
export const WebPageCommentOpen = doc(PAGE, (_, d) => {
  const c = {
    id: 9001,
    key: ROW,
    quote: ROW_TEXT,
    text: '\u5e73\u5747\u5ba2\u5355\u4ef7\u6539\u6210\u6309\u5468\u770b', // show the average order by week
    by: 'you',
    t: new Date().toISOString(),
  }
  d.blocks = [...d.blocks.filter((b) => b.key !== ROW), { key: ROW, kind: 'para', text: ROW_TEXT, comments: [c] }]
  U.docThreads.add(threadKey(c))
})
/** a thread on the row of three cards, as Taska sends it */
const onRow = (d: Doc, c: Omit<Comment, 'key' | 'quote' | 'by'>) => {
  const full: Comment = { ...c, key: ROW, quote: ROW_TEXT, by: 'you' }
  d.blocks = [...d.blocks.filter((b) => b.key !== ROW), { key: ROW, kind: 'para', text: ROW_TEXT, comments: [full] }]
  return full
}
/** r799: said about a part and not sent yet (desktop: Stop puts it in the box): it waits beside the part, Not sent */
export const WebPageNotSent = also(
  doc(PAGE, (_, d) => {
    U.docInspect = true
    U.docQuote = { key: ROW, text: ROW_TEXT }
    U.vcMarks = [{ label: ROW_TEXT, d: d.d, key: ROW, quote: ROW_TEXT }]
    U.docThreads.add(`${ROW}#new`)
  }),
  // what was said about it, under its quote in the box
  { platform: 'desktop', text: `> “${ROW_TEXT}”\n按周看更清楚` }, // clearer by week
)
/** r799: a comment just sent is on its part at once, open under it, while it is saved (a voice note's words still
 * coming: …); it has no Edit, Move or Delete until it is saved */
export const WebPageCommentSaving = doc(PAGE, (_, d) => {
  onRow(d, { id: -1, text: '…', t: new Date().toISOString() })
  U.docThreads.add(ROW)
})
/** B12 (r562): a resolved thread on a web page: its count looks done (a check, grey), as beside a paragraph */
export const WebPageResolved = doc(PAGE, (_, d) => {
  const c = onRow(d, { id: 9002, th: 9002, text: '就这样', t: ago(60) }) // fine as it is
  d.resolved = { [threadKey(c)]: ago(30) }
})
/** A paragraph picked to comment on: the box below writes to it. */
export const ParagraphPicked = doc(PLAN, (_, d) => {
  U.docSel = new Set([d.blocks[1].key])
})
/** Words selected inside a paragraph: the quote goes with the comment. */
export const WordsSelected = doc(PLAN, (_, d) => {
  U.docQuote = { key: d.blocks[3].key, text: '\u6539\u52a8\u5c0f\uff0c\u4eca\u5929\u80fd\u4e0a\u7ebf' }
})
/** Replying in a thread. */
export const Replying = doc(PLAN, (_, d) => {
  const c = d.comments.find((x) => x.key !== 'doc')!
  U.docReply = threadKey(c)
  U.docThreads.add(threadKey(c))
})
/** Circle to select: draw around paragraphs to pick them (the phone's Mark an area; the desktop has no such button). */
export const CircleToSelect = also(
  doc(PLAN, () => (U.docCircle = true)),
  { platform: 'phone' },
)
/** A thread you resolved: folded away. */
export const ResolvedThread = doc(PLAN, (_, d) => {
  const c = d.comments.find((x) => x.key !== 'doc')!
  d.resolved = { [threadKey(c)]: new Date().toISOString() }
  d.open = Math.max(0, d.open - 1)
})
// the document open in its editor: where it is read on the desktop, in a sheet on the phone
const editing = (d: Doc) => {
  U.docEdit = true
  U.docText = d.md
  if (!desk()) OV.spec = { kind: 'doc-edit', props: {}, focus: false, tall: true }
}
/** The editor: the first line is the title. */
export const Editing = doc(PLAN, (_, d) => editing(d))
/** A document with no comments yet. */
export const NoComments = doc(LOAD, () => {
  for (const d of model.S.docs) if (d.title.startsWith(LOAD)) d.comments = []
})
/** Words selected with the pointer: the bar over them comments on them, or speaks to them. */
export const SelectionBar: Story = {
  ...doc(PLAN),
  play: async ({ canvasElement }) => {
    await new Promise((r) => setTimeout(r, 400))
    const p = [...canvasElement.ownerDocument.querySelectorAll('section[data-key] p, [data-key] li')].find((e) =>
      (e.textContent || '').includes('\u4eca\u5929\u80fd\u4e0a\u7ebf'),
    )
    const t = p && [...p.childNodes].find((n) => n.nodeType === 3 && (n.textContent || '').length > 6)
    if (!t) return
    const r = document.createRange()
    r.setStart(t, 0)
    r.setEnd(t, Math.min(10, (t.textContent || '').length))
    getSelection()?.removeAllRanges()
    getSelection()?.addRange(r)
    document.dispatchEvent(new Event('selectionchange'))
    bump('vc')
  },
}

// ---------------------------------------------------------------- T522, R531: the other states of a Markdown document
// (the demo export plan: 1 its title, 2 the conclusion, 4 a list of two, 6 a list of steps, 7 a table, 8 a quote)

/** The contents of a long document, opened. */
export const ContentsOpen = also(doc(LOAD), {
  step: (page) => page.querySelector('details:has(+ #docBlocks)')?.setAttribute('open', ''),
})
/** The pointer on a paragraph: speak and comment beside it (desktop, B340). */
export const PointingAtParagraph = also(doc(PLAN), { platform: 'desktop', hover: [SEC(8)] })
/** The pointer on an item of a list: that item lights, with its own two buttons beside it (desktop, B355). */
export const PointingAtListItem = also(doc(PLAN), {
  platform: 'desktop',
  hover: [SEC(4)],
  step: (page) =>
    page.querySelectorAll(`${SEC(4)} li`)[1]?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })),
})

// ---------------------------------------------------------------- comment threads

/** a comment more in its thread, as Taska sends it: in the document's comments and in its paragraph's */
const add = (d: Doc, c: Comment) => {
  d.comments.push(c)
  d.blocks.find((b) => b.key === c.key)?.comments.push(c)
}
/** the conclusion's thread (at the top, so the phone shows it too) opened from its count: over the text beside its
 * paragraph (desktop), under it (phone) */
const top = (d: Doc) => d.blocks[1].comments[0]
const openTop = (d: Doc) => U.docThreads.add(threadKey(top(d)))
/** A count opens its paragraph's comments. */
export const ThreadOpened = doc(PLAN, (_, d) => openTop(d))
/** The pointer on your comment in an open thread: Edit, Move, Delete over its corner (desktop, B14). */
export const PointingAtYourComment = also(
  doc(PLAN, (_, d) => openTop(d)),
  { platform: 'desktop', hover: ['[data-dc="23"]'] },
)
/** An agent answered since you last looked (the page would mark it New, a dot on the phone's count: a finding of T529, it is gone at the next drawing). */
export const NewReply = doc(PLAN, (_, d) => {
  seenMap() // what you had seen was kept before this answer came
  const c = top(d)
  openTop(d)
  add(d, {
    ...c,
    quote: d.blocks[1].text, // a reply quotes its paragraph
    id: 9101,
    // the risk is medium: saving filters changes the database, and it has to be moved over when it ships
    text: '\u98ce\u9669\u662f\u4e2d\uff0c\u56e0\u4e3a\u7b5b\u9009\u5b58\u50a8\u8981\u6539\u6570\u636e\u5e93\uff0c\u4e0a\u7ebf\u8981\u8fc1\u79fb\u3002',
    by: 'claude-code',
    t: new Date().toISOString(),
    files: [],
  })
})
/** A comment with a picture and a voice note (its words under it). */
export const CommentWithFiles = doc(PLAN, (_, d) => {
  openTop(d)
  add(d, {
    ...top(d),
    quote: d.blocks[1].text,
    id: 9102,
    text: '\u6d4b\u7684\u65f6\u5019\u6309\u8fd9\u5f20\u56fe\u91cc\u7684\u987a\u5e8f\u70b9\u3002', // tap in the order of this picture
    by: 'you',
    t: ago(20),
    files: [
      { f: 'f2-shot-checkout.png', name: 'shot-checkout.png', mime: 'image/png', size: 10483 },
      {
        f: 'f3-voice_0-08.webm',
        name: 'voice_0-08.webm',
        mime: 'audio/webm',
        size: 15245,
        // use the date format picked in Settings, not ISO
        tr: '\u65e5\u671f\u683c\u5f0f\u7528\u8bbe\u7f6e\u91cc\u9009\u7684\u90a3\u4e2a\uff0c\u4e0d\u8981 ISO \u683c\u5f0f\u3002',
      },
    ],
  })
})
/** A resolved thread opened again to read it: Reopen instead of Resolve. */
export const ResolvedOpened = doc(PLAN, (_, d) => {
  d.resolved = { [threadKey(top(d))]: ago(30) }
  d.open = Math.max(0, d.open - 1)
  openTop(d)
})
/** The words a thread was on are no longer in the document: it stays, under Original text changed at the document's
 * end (phone, scrolled there), and in the item's conversation (desktop). */
const textChanged = doc(PLAN, (_, d) => {
  const c: Comment = {
    id: 9103,
    key: 'a0b1c2d3e4',
    th: 9103,
    quote: '\u5bfc\u51fa\u65f6\u53ea\u5bfc\u51fa CSV \u683c\u5f0f\u3002', // export CSV only
    text: '\u8981\u4e0d\u8981\u4e5f\u652f\u6301 Excel\uff1f', // Excel too?
    by: 'you',
    t: ago(90),
    files: [],
  }
  d.comments.push(c)
  d.detached = [{ key: c.key, quote: c.quote, comments: [c] }]
  d.open += 1
})
export const TextChanged = also(textChanged, {
  step: (page) =>
    [...page.querySelectorAll('div')]
      .find((e) => e.textContent === 'Original text changed')
      ?.scrollIntoView({ block: 'center' }),
})
// the quote at the document's end, as the box names it, and what you say about it
const QUOTE = '\u65b9\u6848 B \u505a\u5b8c\u4e4b\u540e\uff0cA \u7684\u4ee3\u7801\u53ef\u4ee5\u5220\u6389\u3002',
  SAID = '\u8fd9\u6bb5\u5220\u6389\u5427\uff0c\u4e0b\u5468\u518d\u8bf4\u3002' // drop this, next week
/** A comment written in the box, not sent yet: its count opens a dashed Not sent card where it will go (desktop, B340). */
export const NotSentYet = also(
  doc(PLAN, (_, d) => {
    const b = d.blocks[7]
    U.vcMarks = [{ label: QUOTE, d: d.d, key: b.key, quote: b.text }]
    U.docThreads.add(`${b.key}#new`)
  }),
  { platform: 'desktop', text: `> \u201c${QUOTE}\u201d\n${SAID}` },
)

// ---------------------------------------------------------------- choices

const CHOICES = 2 // the paragraph of choices
/** Ticked on the page and not sent yet (B412): the box's line says how many, with its own Send choices; the box's round
 * button stays the mic (B524, r736); the document's top says it too. */
export const TickedNotSent = doc(TICKS, (_, d) => {
  clearTicks(d.d)
  const k = tickKeys(d)[CHOICES].k
  tickDoc(d.d, k, 0)
  tickDoc(d.d, k, 1)
})
/** A sent form pointed at: Modify shows (desktop, F428). */
export const SentPointedAt = also(Sent, { platform: 'desktop', hover: ['[class~="group/form"]'] })
/** Modify on a sent form: it is a form again, its ticks kept, to change and send again (F428). */
export const SentChanging = doc(TICKS, (_, d) => {
  sent(d)
  tickModify(d.d, tickKeys(d)[CHOICES].k)
})
/** The item asked you to pick here and you replied on the item instead: Skipped (T472). */
export const Skipped = doc(TICKS, (x, d) => {
  clearTicks(d.d)
  const it = x.S.items.find((i) => i.n === d.n)
  if (!it) return
  // as Taska sends it then: what you say after a question answers it (store.waiting), and the agent is to read it
  it.wait = null
  it.reply = true
  it.thread.push({
    id: 9201,
    by: 'you',
    kind: 'say',
    // product pages and checkout first, the emails and the help centre next time
    text: '\u5148\u505a\u5546\u54c1\u9875\u548c\u7ed3\u8d26\uff0c\u90ae\u4ef6\u548c\u5e2e\u52a9\u4e2d\u5fc3\u4e0b\u4e00\u7248\u3002',
    t: ago(5),
    src: null,
    files: [],
  })
})

// ---------------------------------------------------------------- the editor

/** A new document on an item: the editor opens empty in a sheet; Create saves it. */
export const NewDocument = doc(PLAN, (_, d) => {
  Object.assign(U, { doc: null, docNew: d.n, docEdit: true, docText: '' })
  OV.spec = { kind: 'doc-edit', props: {}, focus: false, tall: true }
})
/** Speaking into the editor: Stop with the time; the words go at the mark, typing goes on (F208). */
export const EditorListening = doc(PLAN, (_, d) => {
  editing(d)
  DV.rec = { t0: Date.now() - 9000, key: docKey(), mark: '', scope: null } as unknown as typeof DV.rec
})
/** A voice note said into the editor, its words still being worked out. */
export const EditorWorkingOutWords = doc(PLAN, (_, d) => {
  editing(d)
  DV.notes = [{ key: docKey(), mark: '', ms: 8000, scope: null }]
})
