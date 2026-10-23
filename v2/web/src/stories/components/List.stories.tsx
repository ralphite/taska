// T457: the item list and its rows, in every state, on the demo project. The list column is as wide as on the page.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ItemRow, NeedsRow, WorkerMark, Zone } from '../../components/List'
import { U, byN, parseRef } from '../../lib/state'
import { VW_STATE } from '../../lib/views'
import { Pane, type Setup } from '../lib/demo'
import { ListColumn } from '../lib/column'

const meta: Meta = {
  title: 'Components/List',
  parameters: {
    covers: [
      'List',
      'ItemList',
      'Tree',
      'NeedsBand',
      'GoThroughBtn',
      'ArchiveAllBtn',
      'ViewBar',
      'OwnView',
      'SelBar',
      'ListMore',
      'HeldRow',
      'SettledRow',
      'HitLine',
      'RowActs',
      'SwipeRow',
      'SearchHints',
      'CrossHits',
    ],
  },
}
export default meta
type Story = StoryObj

const list = (setup?: (x: Setup) => void): Story => ({
  parameters: { taska: { setup } },
  render: () => <ListColumn />,
})

/** Items › Active: what needs you first (amber), then the agents' queue, then Later, then what finished lately. */
export const Active = list()
export const All = list(() => (U.status = 'every'))
export const NeedsYou = list(() => (U.status = 'wait'))
export const Queue = list(() => (U.status = 'queued'))
export const Later = list(() => (U.status = 'later'))
export const Finished = list(() => (U.status = 'closed'))
export const Archive = list(() => (U.tab = 'archive'))
export const Rules = list(() => (U.tab = 'rules'))
/** A search: the words found are marked; words found only inside an item show their line under the title. */
export const Search = list(() => (U.q = '\u5bfc\u51fa'))
export const SearchNothingFound = list(() => (U.q = 'kubernetes'))
/** Bugs only, P0 and P1. */
export const Filtered = list(() => {
  U.type = 'bug'
  U.pri = 'P0'
})
/** Every item in Needs you shown (the band shows five and a row for the rest). */
export const NeedsYouAllShown = list(() => (U.needsAll = true))
/** Going through what needs you: the band says where you are and what you settled. */
export const GoingThrough = list(({ it }) => {
  const needs = [...byN.values()].filter((x) => x.wait || x.status === 'proposed' || x.status === 'review')
  U.go = {
    list: needs.map((x) => x.n),
    done: new Set([needs[0].n]),
    how: { [needs[0].n]: 'Approved' },
    undo: {},
    at: needs[1].n,
    hidden: 0,
    by: 'list',
  }
  U.open = it('B2').n
})
/** One item open: its row is marked. */
export const OneOpen = list(({ it }) => (U.open = it('F1').n))
/** Several rows picked with Cmd or Shift: the bar acts on all of them. */
export const Picked = list(({ it }) => {
  for (const c of ['T3', 'F8', 'T15']) U.sel.add(it(c).n)
})
/** Subitems folded under their parent. */
export const SubitemsFolded = list(({ it }) => {
  U.folded.add(it('F1').n)
  U.folded.add(it('T12').n)
})
/** A row you just acted on, while the list holds still: one quiet line with Undo. */
export const JustActedOn = list(({ it }) => {
  U.settle.set(it('T7').n, { said: 'T07 is done', undo: () => {} })
  it('T7').status = 'done'
})
/** Your own saved views beside the preset ones. */
export const OwnViews = list(() => {
  VW_STATE.list = [
    { name: 'P0 bugs', q: '', type: 'bug', when: 'all', status: 'all', pri: 'P0', sort: 'all' },
    { name: '\u7ed3\u8d26', q: '\u7ed3\u8d26', type: 'all', when: 'all', status: 'every', pri: 'all', sort: 'all' },
  ] as unknown as typeof VW_STATE.list
})
export const EmptyProject: Story = { ...list(), parameters: { taska: { project: 'website' } } }
export const SmallProject: Story = { ...list(), parameters: { taska: { project: 'mobile-app' } } }

// ---------------------------------------------------------------- one row

const row = (ref: string, setup?: (x: Setup) => void, depth = 0): Story => ({
  parameters: { taska: { setup } },
  render: () => {
    const it = byN.get(parseRef(ref) as number)!
    return (
      <Pane w="list">
        <div id="list">
          <ItemRow it={it} depth={depth} group={[...byN.values()]} />
        </div>
      </Pane>
    )
  },
})
export const RowOpen = row('T3')
export const RowInProgress = row('F1')
/** The agent on it has been quiet a while: its mark turns amber. */
export const RowInProgressQuiet = row('T12', ({ it }) => {
  it('T12').agent = { by: 'codex', t: new Date(Date.now() - 3 * 3600e3).toISOString() }
})
export const RowProposed = row('F11')
export const RowWaitsForReview = row('B6')
export const RowDone = row('B10')
export const RowWontDo = row('T5')
export const RowArchived = row('B21')
export const RowSubitem = row('T14', undefined, 1)
export const RowWithPicture = row('B36')
export const RowLater = row('F8')
export const RowRule = row('R16')
export const RowLongChineseTitle = row('B25')
export const RowLongEnglishTitle = row('T24', ({ it }) => {
  it('T24').title =
    'Update the shipping rates for Canada and Mexico after the new carrier contract, including the remote areas surcharge'
})
/** New from an agent since you last looked: a blue dot. */
export const RowUnread = row('T13', ({ it }) => {
  it('T13').read = { you: 0 }
})
export const RowCurrent = row('F1', ({ it }) => (U.open = it('F1').n))
export const RowPicked = row('T3', ({ it }) => U.sel.add(it('T3').n))
/** The pointer on a row: its buttons show over the end of the title (desktop). */
export const RowHover: Story = {
  ...row('T3'),
  parameters: { pseudo: { hover: ['article .group'] } },
}
export const RowP0 = row('B36')
export const RowP3 = row('T5')

// ---------------------------------------------------------------- a row that waits on you

const need = (ref: string): Story => ({
  render: () => (
    <Pane w="list">
      <div id="list">
        <NeedsRow it={byN.get(parseRef(ref) as number)!} />
      </div>
    </Pane>
  ),
})
export const NeedsQuestion = need('T7')
export const NeedsChecklist = need('T9')
export const NeedsBlocked = need('B2')
export const NeedsProposed = need('I4')
export const NeedsReview = need('B6')
export const NeedsRuleProposed = need('R17')

// ---------------------------------------------------------------- group headers, the agent mark

export const Zones: Story = {
  render: () => (
    <Pane w="list">
      <Zone kind="needs" label="Needs you" n={7} />
      <Zone kind="queue" label="Queue" n={12} />
      <Zone kind="later" label="Later" n={3} />
      <Zone kind="done" label="Finished" n={18} />
      <Zone kind="rules" label="In force" n={4} />
    </Pane>
  ),
}
export const AgentMark: Story = {
  render: () => (
    <div className="flex items-center gap-4 p-6">
      <WorkerMark it={byN.get(parseRef('F1') as number)!} />
      <WorkerMark
        it={{
          ...byN.get(parseRef('T12') as number)!,
          agent: { by: 'codex', t: new Date(Date.now() - 4 * 3600e3).toISOString() },
        }}
      />
    </div>
  ),
}
