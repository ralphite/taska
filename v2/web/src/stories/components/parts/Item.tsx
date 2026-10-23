// T457: an item's pane (the right side on the desktop, the whole page on the phone) in every state an item has, and
// the card that asks you, on its own.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DetailView, NeedsCard } from '../../../components/Detail'
import { Column } from '../../lib/column'
import { D, EMPTY_STATE, U, byN, byR, kids, lastAgentMsg, model, parseRef } from '../../../lib/state'
import { clearTicks, tickDoc, tickKeys } from '../../../lib/doctick'
import type { Item } from '../../../lib/types'
import { Pane, type Setup } from '../../lib/demo'
import { looks } from '../../lib/states'

// what this part of Storybook shows (T512: its stories are in the folders beside this file)
export const area: Meta = {
  parameters: {
    covers: [
      'DetailView',
      'ItemPage',
      'ItemHead',
      'ItemActs',
      'ItemNav',
      'BarIcon',
      'BarText',
      // NoSelection: the item pane with no item to show (a link to an item that is not there, the page still loading)
      'NoSelection',
      // Missing: an item or document the address names, still loading or not in this project (D77 #1 #2)
      'Missing',
      'Editor',
      'Inline',
      'SectionHead',
    ],
  },
}
export type Story = StoryObj

/** The item pane with this item open. */
const item = (ref: string | null, setup?: (x: Setup) => void, wide = false): Story => ({
  parameters: {
    taska: {
      setup: (x) => {
        U.open = ref ? x.it(ref).n : null
        setup?.(x)
      },
    },
  },
  render: () => <Column wide={wide} />,
})
// T522 (r731): a state seen only under the pointer, drawn without one (storybook-addon-pseudo-states); the desktop
// only, as the phone has no pointer
const pointed = (s: Story, hover: string[]): Story => ({
  ...s,
  parameters: { ...s.parameters, pseudo: { hover }, platform: 'desktop' },
})

// the demo's B6 has your reply after the agent's report (that is "Finished, you replied"); here the report is the last
// word, so the card asks you to accept it
const reportLast = ({ it }: Setup) => {
  const i = it('B6'),
    last = lastAgentMsg(i)
  if (last) i.thread = i.thread.slice(0, i.thread.indexOf(last) + 1)
  i.reply = false
}
// T522: the page before Taska's first answer (a reload): its own empty state, nothing of the project yet
const notLoaded = () => {
  model.S = structuredClone(EMPTY_STATE)
  for (const m of [byN, byR, kids]) m.clear()
}

export const InProgressWithTalk = item('F1')
/** An agent is blocked and needs you: the amber card at the end of the talk, and its status reads Needs you (R055,
 * B535), though it is still in progress (its menu ticks that). */
export const Blocked = item('B2')
/** An agent asks you: its status reads Needs you too, while it is open. */
export const Question = item('T7')
/** A question with several answers you can tick, and its plan as a document. */
export const ChecklistQuestion = item('T9')
/** B524 (r736): a choice ticked in its document and not sent yet: the document's card in Documents says so. */
export const DocumentChoicesNotSent = item('T9', ({ S, it }) => {
  const d = S.docs.find((x) => x.n === it('T9').n && x.fmt !== 'html')
  if (!d) return
  clearTicks(d.d)
  const form = tickKeys(d).find(({ b }) => /^\s*[-*+]\s+\[ \]/m.test(b.text))
  if (form) tickDoc(d.d, form.k, 0)
})
/** An idea the agent proposed, with a web page preview and its proposal. */
export const ProposedWithPreview = item('I4')
/** Proposed, nothing said yet. */
export const ProposedEmpty = item('F11')
/** Finished by the agent, waiting for you: Not yet or Accept. */
export const WaitsForReview = item('B6', reportLast)
export const Done = item('B10')
export const WontDo = item('T5')
export const Open = item('T3')
export const Later = item('F8')
export const Subitem = item('T14')
/** A parent: its subitems, its plan document, two agents at work. */
export const WithSubitemsAndDocument = item('T12')
/** B532 (r760): its only subitem in Later, which the list's Active view does not show: marked Later. On the desktop
 * at full width (O), so the item, down to its subitems, is in view beside its talk. */
export const SubitemInLater = item(
  'T12',
  ({ it }) => {
    Object.assign(it('T13'), { when: 'later', status: 'open' })
    D.full = true
  },
  true,
)
export const RuleInForce = item('R16')
export const RuleProposed = item('R17')
/** A long talk (17 messages), the item finished. */
export const LongTalk = item('B35')
/** The agent asked, then took its question back. */
export const QuestionWithdrawn = item('T38')
/** A proposal you approved: the card says what you decided. */
export const Decided = item('I4', ({ it }) => {
  const i = it('I4')
  i.status = 'open'
  i.decided = { from: 'proposed', to: 'open', msg: lastAgentMsg(i)?.id ?? null }
})
export const WithPictures = item('B36')
export const Archived = item('B21')
/** Opened from its link while the page waits for Taska's first answer (a reload). */
export const Loading = item('T7', notLoaded)
/** Its link names an item the project does not have (T99). */
export const NotThere = item(null, () => (U.open = 99))
/** Editing the title, details and next step. */
export const Editing = item('T3', ({ it }) => (U.editing = it('T3').n))
/** Adding the first subitem: Add pressed, its title box open (an item short enough that the box is in sight above
 * the line, as the page scrolls it into sight). */
export const AddingSubitem = item('T38', ({ it }) => (U.subFor = it('T38').n))
/** The line between the item and its talk, pointed at: it turns blue, to drag (desktop). */
export const LinePointed = pointed(item('T3'), ['[data-grip]'])
/** Full width (O): the list makes room; an item that fits stays in one column (desktop). */
export const FullWidth = item('T3', () => (D.full = true), true)
/** Full width: the item (its body, subitems, document) beside its talk, one line between them from the top to the
 * bottom, the box under the talk (desktop, B495). */
export const TwoColumns = item('F1', () => (D.full = true), true)
/** Your words on their way to the item, before Taska has them. */
export const ReplySending = item('F1', ({ it }) => {
  U.outbox.push({
    id: 'q1',
    q: 'q1',
    t: Date.now(),
    text: '\u624b\u673a\u4e0a\u7684\u95ee\u9898\u4f18\u5148\u5904\u7406',
    files: [],
    scope: 'F' + it('F1').n,
    p: '/p/shop/',
    sending: true,
  })
})
/** The item pane while the list column shows Documents and none is picked (desktop). */
export const NothingPicked = item(null, () => (U.side = 'docs'))

// ---------------------------------------------------------------- the card that asks you, alone

const card = (ref: string, setup?: (x: Setup) => void): Story => ({
  parameters: { taska: { setup } },
  render: () => (
    <Pane w="item">
      <div className="p-4">
        <NeedsCard it={byN.get(parseRef(ref) as number) as Item} />
      </div>
    </Pane>
  ),
})
export const CardQuestion = card('T7')
export const CardChecklist = card('T9')
/** A question on an idea still proposed: Approve stays one tap away beside the answer (B299). */
export const CardQuestionOnProposal = card('T7', ({ it }) => {
  const i = it('T7')
  i.status = 'proposed'
  i.decided = null
})
export const CardBlocked = card('B2')
export const CardProposal = card('I4')
export const CardProposedNoWords = card('F11')
export const CardReview = card('B6', reportLast)
export const CardRule = card('R17')
const approved = ({ it }: Setup) => {
  const i = it('I4')
  i.status = 'open'
  i.decided = { from: 'proposed', to: 'open', msg: lastAgentMsg(i)?.id ?? null }
}
export const CardDecided = card('I4', approved)
/** Approved, pointed at: Modify shows (on the phone it always shows). */
export const CardDecidedPointed = pointed(CardDecided, ['.group\\/form'])
/** Approved, then Modify: the two buttons work again; the one you chose before closes it, as Cancel does. */
export const CardDecidedModify = card('I4', (x) => {
  approved(x)
  U.remodify = x.it('I4').n
})
/** A proposal you declined. */
export const CardDeclined = card('I4', ({ it }) => {
  const i = it('I4')
  i.status = 'dropped'
  i.decided = { from: 'proposed', to: 'dropped', msg: lastAgentMsg(i)?.id ?? null }
})
export const CardAccepted = card('B6', ({ it }) => {
  const i = it('B6')
  i.status = 'done'
  i.decided = { from: 'review', to: 'done', msg: lastAgentMsg(i)?.id ?? null }
})
// ---------------------------------------------------------------- under the pointer, the keyboard, pressed, busy
// T522 (r731, r762): every look of the item pane's head, its chips and its subitems side by side, each drawn without a
// pointer or a key (../../lib/states.tsx); each shows the top of the pane (or its subitems), F01 open. The desktop only.
// The pane alone (the page has one input box, so it is not drawn once a look).
const pane = (tall = false) => (
  <div className={`${tall ? 'h-[400px]' : 'h-[200px]'} overflow-hidden`}>
    <Pane w="item" h="flex h-[calc(100dvh-3rem)] flex-col">
      <DetailView hidden={false} />
    </Pane>
  </div>
)
const DONE = '#dActs > button:first-child',
  SUBS = '[data-act="sub-new"]',
  SUB = '.divide-y > button[data-act="goto"]'
export const HeadLooks: Story = looks(
  [
    { name: 'As it is', draw: pane },
    { name: 'Pointer on Done', draw: () => pane(), hover: [DONE] },
    { name: 'Keys: Tab on Done', draw: () => pane(), focus: [DONE] },
    { name: 'Done pressed', draw: () => pane(), hover: [DONE], pressed: [DONE] },
    { name: 'Done sent, waiting for Taska', draw: () => pane(), marks: [[DONE, 'aria-busy', 'true']] },
    { name: 'Pointer on All actions (⋯)', draw: () => pane(), hover: ['#itemMenuBtn'] },
    { name: 'Pointer on the next item', draw: () => pane(), hover: ['#dNav button:nth-child(2)'] },
    { name: 'Pointer on the status', draw: () => pane(), hover: ['[data-arm="s"]'] },
    { name: 'Keys: Tab on the priority', draw: () => pane(), focus: ['[data-arm="p"]'] },
    {
      name: 'Pointer on Now (to Later)',
      draw: () => pane(),
      hover: ['#detailView [data-f="when"][title]:not(#dActs *)'],
    },
    { name: 'Its subitems', draw: () => pane(true), scroll: SUBS },
    {
      name: 'Pointer on a subitem',
      draw: () => pane(true),
      scroll: SUBS,
      hover: [SUB + ':first-child'],
    },
    {
      name: 'A subitem pressed',
      draw: () => pane(true),
      scroll: SUBS,
      pressed: [SUB + ':first-child'],
    },
    {
      name: 'Pointer on Add (a subitem)',
      draw: () => pane(true),
      scroll: SUBS,
      hover: ['[data-act="sub-new"]'],
    },
  ],
  { w: 'w-full', setup: ({ it }) => (U.open = it('F1').n) },
)
/** The line between the item and its talk, dragged: it stays blue while you drag. */
export const LineDragged: Story = looks(
  [{ name: 'The line dragged', draw: () => <Column />, marks: [['[data-grip]', 'data-drag', '']] }],
  { w: 'w-full', setup: ({ it }) => (U.open = it('T3').n) },
)
/** Finished work you sent back with Not yet: the agent has it again. */
export const CardSentBack = card('B6', ({ it }) => {
  const i = it('B6')
  i.status = 'doing'
  i.decided = { from: 'review', to: 'doing', msg: lastAgentMsg(i)?.id ?? null }
})
