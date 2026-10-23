// T457: an item's pane (the right side on the desktop, the whole page on the phone) in every state an item has, and
// the card that asks you, on its own.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { NeedsCard } from '../../components/Detail'
import { Column } from '../lib/column'
import { D, U, byN, lastAgentMsg, parseRef } from '../../lib/state'
import type { Item } from '../../lib/types'
import { Pane, type Setup } from '../lib/demo'

const meta: Meta = {
  title: 'Components/Item',
  parameters: {
    covers: [
      'DetailView',
      'ItemPage',
      'ItemHead',
      'ItemActs',
      'ItemNav',
      'BarIcon',
      'BarText',
      'GoStrip',
      'NoSelection',
      'Editor',
      'Inline',
    ],
  },
}
export default meta
type Story = StoryObj

/** The item pane with this item open. */
const item = (ref: string | null, setup?: (x: Setup) => void): Story => ({
  parameters: {
    taska: {
      setup: (x) => {
        U.open = ref ? x.it(ref).n : null
        setup?.(x)
      },
    },
  },
  render: () => <Column />,
})

export const InProgressWithTalk = item('F1')
/** An agent is blocked and needs you: the amber card at the end of the talk. */
export const Blocked = item('B2')
export const Question = item('T7')
/** A question with several answers you can tick, and its plan as a document. */
export const ChecklistQuestion = item('T9')
/** An idea the agent proposed, with a web page preview and its proposal. */
export const ProposedWithPreview = item('I4')
/** Proposed, nothing said yet. */
export const ProposedEmpty = item('F11')
/** Finished by the agent, waiting for you to accept it. */
export const WaitsForReview = item('B6')
export const Done = item('B10')
export const WontDo = item('T5')
export const Open = item('T3')
export const Later = item('F8')
export const Subitem = item('T14')
/** A parent: its subitems, its plan document, two agents at work. */
export const WithSubitemsAndDocument = item('T12')
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
/** Editing the title, details and next step. */
export const Editing = item('T3', ({ it }) => (U.editing = it('T3').n))
/** Full width: the list makes room (desktop). */
export const FullWidth = item('F1', () => (D.full = true))
/** As wide as the window (full width, or a wide screen): the item beside its talk, one line between them from the top
 * to the bottom, the box under the talk (desktop; B495). */
export const TwoColumns: Story = {
  parameters: { taska: { setup: ({ it }) => (U.open = it('F1').n) } },
  render: () => <Column wide />,
}
/** Going through what needs you: the amber strip on top (desktop). */
export const GoingThrough = item('T7', ({ it }) => {
  const list = ['B2', 'T7', 'T9', 'I4', 'B6'].map((c) => it(c).n)
  U.go = {
    list,
    done: new Set([list[0]]),
    how: { [list[0]]: 'Answered' },
    undo: {},
    at: list[1],
    hidden: 0,
    by: 'list',
  }
})
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
/** Nothing picked while the list column shows Documents, Activity or Deleted (desktop; with nothing open on Items
 * the desktop shows the New input page instead). */
export const NothingOpen = item(null, () => (U.side = 'docs'))

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
export const CardBlocked = card('B2')
export const CardProposal = card('I4')
export const CardProposedNoWords = card('F11')
export const CardReview = card('B6')
export const CardRule = card('R17')
export const CardDecided = card('I4', ({ it }) => {
  const i = it('I4')
  i.status = 'open'
  i.decided = { from: 'proposed', to: 'open', msg: lastAgentMsg(i)?.id ?? null }
})
export const CardAccepted = card('B6', ({ it }) => {
  const i = it('B6')
  i.status = 'done'
  i.decided = { from: 'review', to: 'done', msg: lastAgentMsg(i)?.id ?? null }
})
