// T457: a document as you read it, comment on it and edit it: in the item pane on the desktop, in a sheet on the phone.
// B555: each story is the real page with the document open at its address (/p/shop/D1), after Yadong's steps there
// (an agent writing to the real Taska server in the page when the steps change something), the document's pane and
// its box on the desktop, the whole screen with its sheet on the phone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { place } from '../../lib/onpage'
import type { Do, Twin } from '../../lib/twin'

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

// the demo's documents: D1 the export plan (F01: comments in three places), D2 a web page (I04), D3 the load test
// (T12: long, a table, code, a quote, no comments), D4 the Spanish plan (T09: choices to tick)
const PLAN = 1,
  PAGE = 2,
  LOAD = 3,
  TICKS = 4
const DOC = { d: ['#detailView', '#foot'], p: '#overlay' }
/** Document `d` open, after these steps. */
const doc = (d: number, steps?: Do[], more: Partial<Twin> = {}, on?: 'desktop' | 'phone'): Story =>
  place({ at: `/p/shop/D${d}`, part: DOC, steps, ...more }, on)
/** A part of the document by its place (1: the title; D1: 2 the conclusion, 4 a list of two, 6 a list of steps, 7 a
 * table, 8 a quote). */
const SEC = (i: number) => `#docBlocks > section:nth-child(${i})`
/** A part picked to comment on: Comment beside it under the pointer on the desktop (reading never picks, B340), a tap
 * on the phone. */
const pick = (i: number): Do[] => [
  { point: SEC(i), on: 'd' },
  { click: `${SEC(i)} [data-act="doc-pick"]`, on: 'd' },
  { click: SEC(i), on: 'p' },
]
/** The phone: Aa under the picked part (type instead of speaking): the box comes under the document. */
const aa: Do = { click: '[data-act="doc-type"]', on: 'p' }
const write = (words: string): Do => ({ type: words, into: '#text' })
const send: Do = { click: '#sendBtn[data-act="send"]' }
/** The conclusion's thread (D1), opened from its count: over the text beside its paragraph on the desktop, under it
 * on the phone. */
const thread: Do = { click: `${SEC(2)} [data-act="doc-thread"], [data-act="doc-thread"][data-key^="d7291783ec#"]` }
const SAID = '\u8fd9\u6bb5\u5220\u6389\u5427\uff0c\u4e0b\u5468\u518d\u8bf4\u3002' // drop this, next week

/** Comments beside the paragraphs they are on (desktop), and one on the whole document. */
export const WithComments = doc(PLAN)
/** A long document starts with its contents (D3 has no comments yet). */
export const LongWithOutline = doc(LOAD)
/** A form: choices to tick, none ticked yet. */
export const Checklist = doc(TICKS)
// two choices ticked and sent (Send choices, on the box's line)
const tick = (i: number): Do => ({ click: `[data-act="doc-tick"][data-d="4"][data-i="${i}"]` })
const ticksSent: Do[] = [tick(0), tick(1), { click: '[data-act="doc-ticks-send"]' }, { wait: 1000 }]
/** Sent: the ticks are in the document; the form is quieter, Submitted under it, Modify on hover (desktop). */
export const Sent = doc(TICKS, ticksSent)
/** A web page document, shown as it is. */
export const WebPage = doc(PAGE)
// the web page's own page (in its frame) and a part of it: the row of three cards
const IN_PAGE = '#detailView iframe, #dlg iframe'
const CARDS = `${IN_PAGE} >>> main > div:nth-child(2)`
const inspect: Do = { click: '[data-act="doc-inspect"]', on: 'd' }
/** Comment mode on a web page: pointing lights a part, a click picks it (desktop). */
export const WebPageCommentMode = doc(PAGE, [inspect], { live: false }, 'desktop')
/** A part of a web page picked (B497: no other part lights until Esc); on the phone, speak or type under it. */
export const WebPagePartPicked = doc(PAGE, [inspect, { click: CARDS }], { live: false })
/** B498: speaking about a part: the mic you pressed is Stop, in place (the box shows the same recording); on the
 * phone the time runs under the part. */
export const WebPageRecording = doc(
  PAGE,
  [inspect, { point: CARDS, on: 'd' }, { click: CARDS, on: 'p' }, { click: '[data-act="page-say"]' }, { wait: 2000 }],
  { live: false },
)
/** B503: a part's comments open under its count, the part outlined; a click anywhere else closes them. */
export const WebPageCommentOpen = doc(PAGE, [
  inspect,
  { click: CARDS },
  { click: '[data-act="doc-type"]', on: 'p' },
  write(SAID),
  send,
  { wait: 1500 },
  { click: '[data-act="doc-thread"]' },
])
// a comment on the row of three cards: Comment mode, the row picked (Aa under it on the phone), words, Comment
const onRow: Do[] = [inspect, { click: CARDS }, { click: '[data-act="doc-type"]', on: 'p' }, write(SAID), send]
/** r799: said about a part and not sent yet (desktop: Stop puts it in the box): it waits beside the part, Not sent. */
export const WebPageNotSent = doc(
  PAGE,
  [
    inspect,
    { point: CARDS },
    { click: '[data-act="page-say"]' },
    { wait: 2500 },
    { click: '[data-act="page-say"]' },
    { wait: 2500 },
    { click: '[data-act="doc-thread"][data-key$="#new"]' },
  ],
  { live: true },
  'desktop',
)
/** r799: a comment just sent is on its part at once, open under it, while it is saved (Taska has not answered yet);
 * it has no Edit, Move or Delete until it is saved. */
export const WebPageCommentSaving = doc(PAGE, [...onRow, { wait: 600 }], { net: { '^/p/shop/api/op': 'hang' } })
/** B12 (r562): a resolved thread on a web page: its count looks done (a check, grey), as beside a paragraph. */
export const WebPageResolved = doc(PAGE, [
  ...onRow,
  { wait: 1500 },
  { click: '[data-act="doc-resolve"]' },
  { wait: 1000 },
])
/** r799: a comment on a part the page does not show now (its agent wrote the page again without the row of cards, so
 * the chart under it, which the comment is on, has moved up): under the page on the phone (and on a desktop too narrow
 * for its conversation beside it; wider, it is in the conversation). */
const CHART = '#detailView iframe, #dlg iframe >>> main > div:nth-child(3)'
const PAGE_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font:14px -apple-system,system-ui;' +
  'background:#0b0b0f;color:#e4e4e7}main{padding:24px}h1{font-size:18px;margin:0 0 16px}.card{flex:1;' +
  'background:#18181b;border:1px solid #27272a;border-radius:12px;padding:16px}.l{color:#a1a1aa;font-size:12px}' +
  '.bar{height:120px;display:flex;align-items:flex-end;gap:6px;margin-top:16px}.bar div{flex:1;background:#3b82f6;' +
  'border-radius:4px 4px 0 0}</style></head><body><main><h1>Sales report</h1><div class="card" style="margin-top:16px">' +
  '<div class="l">Orders per day</div><div class="bar"><div style="height:40%"></div><div style="height:55%"></div>' +
  '<div style="height:48%"></div><div style="height:70%"></div><div style="height:62%"></div><div style="height:90%">' +
  '</div><div style="height:75%"></div></div></div></main></body></html>'
export const WebPageNotOnPage = doc(
  PAGE,
  [
    { click: CHART },
    { click: '[data-act="doc-type"]' },
    write('\u6309\u5468\u7684\u90a3\u5f20\u56fe\u8fd8\u5728\u5417\uff1f'), // is the weekly chart still there?
    send,
    { wait: 1500 },
    { agent: `D2 html \u6df1\u8272\u6a21\u5f0f\u9884\u89c8\n  ${PAGE_HTML}` },
  ],
  {},
  'phone',
)
/** A paragraph picked to comment on: the box below writes to it. */
export const ParagraphPicked = doc(PLAN, pick(2), { live: false })
/** Words selected inside a paragraph: the quote goes with the comment. */
const TODAY = '\u6539\u52a8\u5c0f\uff0c\u4eca\u5929\u80fd\u4e0a\u7ebf' // small change, out today
export const WordsSelected = doc(PLAN, [{ select: TODAY, in: SEC(4) }], { live: false })
/** Replying in a thread. */
export const Replying = doc(PLAN, [thread, { click: '[data-act="doc-reply"]' }], { live: false })
/** Circle to select: draw around paragraphs to pick them (the phone's Mark an area; the desktop has no such button). */
export const CircleToSelect = doc(PLAN, [{ click: '[data-act="doc-circle"]' }], { live: false }, 'phone')
/** A thread you resolved: folded away. */
const resolve: Do[] = [thread, { click: '[data-act="doc-resolve"]' }, { wait: 1000 }]
export const ResolvedThread = doc(PLAN, resolve)
/** The editor: the first line is the title. */
const edit: Do = { click: '[data-act="doc-edit"]' }
export const Editing = doc(PLAN, [edit], { live: false })
/** Words selected with the pointer: the bar over them comments on them, or speaks to them (desktop). */
export const SelectionBar = doc(
  PLAN,
  [{ select: TODAY, in: SEC(4) }],
  { live: false, part: [...DOC.d, '#vcBar'] },
  'desktop',
)

// ---------------------------------------------------------------- T522, R531: the other states of a Markdown document

/** The contents of a long document, opened. */
export const ContentsOpen = doc(LOAD, [{ click: 'details:has(+ #docBlocks) > summary' }], { live: false })
/** The pointer on a paragraph: speak and comment beside it (desktop, B340). */
export const PointingAtParagraph = doc(PLAN, undefined, { hover: SEC(8) }, 'desktop')
/** The pointer on an item of a list: that item lights, with its own two buttons beside it (desktop, B355). */
export const PointingAtListItem = doc(PLAN, undefined, { hover: `${SEC(4)} li:nth-child(2)` }, 'desktop')

// ---------------------------------------------------------------- comment threads

/** A count opens its paragraph's comments. */
export const ThreadOpened = doc(PLAN, [thread], { live: false })
/** The pointer on your comment in an open thread: Edit, Move, Delete over its corner (desktop, B14). */
export const PointingAtYourComment = doc(PLAN, [thread], { live: false, hover: '[data-dc="23"]' }, 'desktop')
/** An agent answered in the thread while you look: New on its answer, a dot on the phone's count. */
export const NewReply = doc(PLAN, [
  {
    agent:
      'D1 reply \u00b62 \u98ce\u9669\u662f\u4e2d\uff0c\u56e0\u4e3a\u7b5b\u9009\u5b58\u50a8\u8981\u6539\u6570\u636e\u5e93\uff0c\u4e0a\u7ebf\u8981\u8fc1\u79fb\u3002',
  },
  thread,
])
/** A comment with a picture and a voice note (its words under it): pasted and said into the box, then Comment. */
export const CommentWithFiles = doc(PLAN, [
  ...pick(2),
  aa,
  { paste: '/storybook/fixtures/p__shop__f__f2-shot-checkout.png' },
  { click: '#micBtn[data-act="mic"]' }, // the box holds a picture: the small mic, its check puts the words in
  { wait: 2500 },
  { click: '[data-act="rec-stop"]' },
  { wait: 2500 },
  send,
  { wait: 1500 },
])
/** A resolved thread opened again to read it: Reopen instead of Resolve. */
export const ResolvedOpened = doc(PLAN, [...resolve, thread])
/** The words a thread was on are no longer in the document (its agent wrote it again without the table): the thread
 * stays, under Original text changed at the document's end. */
const PLAN_MD = [
  '**\u7ed3\u8bba**\uff1a\u4eca\u5929\u5148\u505a\u65b9\u6848 A\uff0c\u4e0b\u5468\u518d\u505a\u65b9\u6848 B\u3002',
  '',
  '## \u4e24\u4e2a\u65b9\u6848',
  '',
  '- **A**\uff1a\u5bfc\u51fa\u65f6\u76f4\u63a5\u7528\u5217\u8868\u5f53\u524d\u7684\u7b5b\u9009\u548c\u5217\u987a\u5e8f\u3002\u6539\u52a8\u5c0f\uff0c\u4eca\u5929\u80fd\u4e0a\u7ebf\u3002',
  '- **B**\uff1a\u628a\u7b5b\u9009\u4fdd\u5b58\u5230\u670d\u52a1\u5668\uff0c\u5bfc\u51fa\u3001\u5206\u4eab\u94fe\u63a5\u3001\u5b9a\u65f6\u62a5\u8868\u90fd\u7528\u540c\u4e00\u4efd\u7b5b\u9009\u3002\u6539\u52a8\u5927\uff0c\u8981\u4e00\u5468\u3002',
  '',
  '## \u6b65\u9aa4',
  '',
  '1. \u5bfc\u51fa\u65f6\u5e94\u7528\u7b5b\u9009\u548c\u5217\u987a\u5e8f\u3002',
  '2. \u624b\u673a\u548c\u7535\u8111\u4e0a\u5404\u6d4b\u4e00\u904d\u3002',
  '3. \u4e0a\u7ebf\uff0c\u770b\u4e00\u5929\u9519\u8bef\u65e5\u5fd7\u3002',
  '',
  '> \u65b9\u6848 B \u505a\u5b8c\u4e4b\u540e\uff0cA \u7684\u4ee3\u7801\u53ef\u4ee5\u5220\u6389\u3002',
]
export const TextChanged = doc(
  PLAN,
  [{ agent: ['D1 doc \u5bfc\u51fa\u65b9\u6848', ...PLAN_MD.map((l) => '  ' + l)].join('\n') }],
  // the phone: the end of the document, where the thread stays (the desktop has it in the item's talk)
  { part: { d: DOC.d, p: '#dlg .mt-6.space-y-4.border-t' } },
)
/** A voice comment said about the quote (its own mic, stopped: on the desktop it waits in the box, its words there),
 * not sent yet: its count opens a dashed Not sent card where it will go (desktop, B340). */
export const NotSentYet = doc(
  PLAN,
  [
    { point: SEC(8) },
    { click: `${SEC(8)} [data-act="doc-say"]` },
    { wait: 2500 },
    { click: `${SEC(8)} [data-act="doc-say"]` },
    { wait: 2500 },
    { click: '[data-act="doc-thread"][data-key$="#new"]' },
  ],
  { live: true },
  'desktop',
)

// ---------------------------------------------------------------- choices

/** Ticked on the page and not sent yet (B412): the box's line says how many, with its own Send choices; the box's round
 * button stays the mic (B524, r736); the document's top says it too. */
export const TickedNotSent = doc(TICKS, [tick(0), tick(1)], { live: false })
/** A sent form pointed at: Modify shows (desktop, F428). */
export const SentPointedAt = doc(TICKS, ticksSent, { hover: '[class~="group/form"]' }, 'desktop')
/** Modify on a sent form: it is a form again, its ticks kept, to change and send again (F428). */
export const SentChanging = doc(TICKS, [
  ...ticksSent,
  { point: '[class~="group/form"]', on: 'd' },
  { click: '[data-act="doc-tick-edit"]' },
])
/** T09 asked you to pick in D4 and you replied on T09 instead: Skipped (T472). */
export const Skipped = doc(TICKS, [
  { click: '[data-act="doc-close"]', on: 'd' },
  { click: '[data-act="close"]', on: 'p' },
  write(
    '\u5148\u505a\u5546\u54c1\u9875\u548c\u7ed3\u8d26\uff0c\u90ae\u4ef6\u548c\u5e2e\u52a9\u4e2d\u5fc3\u4e0b\u4e00\u7248\u3002',
  ),
  send,
  { wait: 1500 },
  { click: '#detailView [data-act="doc-open"]' },
])

// ---------------------------------------------------------------- the editor

/** A new document on an item (its menu's New doc): the editor opens empty; Create saves it. */
export const NewDocument = place({
  at: '/p/shop/F1',
  steps: [{ click: '#itemMenuBtn' }, { click: '#dlgBody [data-act="doc-new"]' }],
  live: false,
  part: DOC,
})
/** Speaking into the editor: Stop with the time; the words go at the mark, typing goes on (F208). */
const editorMic: Do[] = [edit, { click: '#docMic' }, { wait: 2500 }]
export const EditorListening = doc(PLAN, editorMic, { live: false })
/** A voice note said into the editor, its words still being worked out (the speech model at work). */
export const EditorWorkingOutWords = doc(PLAN, [...editorMic, { click: '#docMic' }], { heard: { working: true } })
