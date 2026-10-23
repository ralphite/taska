// T457: a document as you read it, comment on it and edit it: in the item pane on the desktop, in a sheet on the phone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Column } from '../../lib/column'
import { VcBar } from '../../../components/Composer'
import { OV, U, bump, desk, model, threadKey } from '../../../lib/state'
import type { Doc } from '../../../lib/types'
import { type Setup } from '../../lib/demo'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'DocView',
      'DocEdit',
      'DocRail',
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
const PLAN = '\u5bfc\u51fa\u65b9\u6848', // the export plan: comments in three places
  LOAD = '\u538b\u6d4b', // the load test: long, with a table, code and a quote
  PAGE = '\u6df1\u8272', // a web page
  TICKS = '\u897f\u73ed\u7259' // choices to tick

/** Comments beside the paragraphs they are on (desktop), and one on the whole document. */
export const WithComments = doc(PLAN)
/** A long document starts with its contents. */
export const LongWithOutline = doc(LOAD)
export const Checklist = doc(TICKS)
export const Ticked = doc(TICKS, (_, d) => {
  d.md = d.md
    .replace('- [ ] \u5546\u54c1\u9875', '- [x] \u5546\u54c1\u9875')
    .replace('- [ ] \u7ed3\u8d26', '- [x] \u7ed3\u8d26')
  d.blocks = d.blocks.map((b) => ({
    ...b,
    text: b.text.replace(/- \[ \] (\u5546\u54c1\u9875|\u7ed3\u8d26)/g, '- [x] $1'),
  }))
})
/** A web page document, shown as it is. */
export const WebPage = doc(PAGE)
/** Comment mode on a web page: pointing lights a part, a click picks it. */
export const WebPageCommentMode = doc(PAGE, () => (U.docInspect = true))
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
/** Circle to select: draw around paragraphs to pick them. */
export const CircleToSelect = doc(PLAN, () => (U.docCircle = true))
/** A thread you resolved: folded away. */
export const ResolvedThread = doc(PLAN, (_, d) => {
  const c = d.comments.find((x) => x.key !== 'doc')!
  d.resolved = { [threadKey(c)]: new Date().toISOString() }
  d.open = Math.max(0, d.open - 1)
})
/** The editor: the first line is the title. */
export const Editing = doc(PLAN, (_, d) => {
  U.docEdit = true
  U.docText = d.md
  if (!desk()) OV.spec = { kind: 'doc-edit', props: {}, focus: false, tall: true }
})
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
