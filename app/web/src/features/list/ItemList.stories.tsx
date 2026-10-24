import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { facts, item, look, message, noRowEvents } from '../../stories/fixtures'
import { EmptyList, ItemList, type DrawnRow, type ListEvents } from './ItemList'
import type { ViewChip } from './rows'

const meta: Meta = { title: 'Components/List/Item list' }
export default meta
type Story = StoryObj

const on: ListEvents = { ...noRowEvents, view() {}, ownView() {}, subMore() {}, needsMore() {}, archiveAll() {} }
const views: ViewChip[] = [
  { value: 'needs', label: 'Needs you', count: 2, on: true, dot: true },
  { value: 'active', label: 'Active', count: 9, on: false, dot: false },
  { value: 'all', label: 'All', count: 31, on: false, dot: false },
  { value: 'queue', label: 'Queue', count: 4, on: false, dot: false },
  { value: 'later', label: 'Later', count: 6, on: false, dot: false },
  { value: 'closed', label: 'Finished', count: 12, on: false, dot: false },
]

function rows(desk: boolean): DrawnRow[] {
  const q = item({ n: 3, status: 'proposed', title: 'Keep the filter in the export file name' })
  const a = item({ n: 7, wait: { id: 4, kind: 'ask', text: 'CSV or Excel?', by: 'claude-code', files: [] }, thread: [message({ id: 4, kind: 'ask', text: 'CSV or Excel?' })] })
  const doing = item({ n: 12, status: 'doing', agent: { by: 'claude-code', t: '2026-10-23T14:30:00-07:00' } })
  const open = item({ n: 14, title: 'Search finds words in the talk' })
  const done = item({ n: 15, status: 'done', title: 'Sort by priority, then by number' })
  return [
    { kind: 'zone', key: 'z1', zone: 'needs', label: 'Needs you', n: 2 },
    { kind: 'needs', key: 'n3', it: q, depth: 0, facts: facts({ code: 'F003' }), look: look(desk), excerpt: 'Proposed by Claude Code' },
    { kind: 'needs', key: 'n7', it: a, depth: 0, facts: facts({ code: 'F007' }), look: look(desk), excerpt: 'CSV or Excel?' },
    { kind: 'needs-more', key: 'nm', open: false, rest: 3 },
    { kind: 'zone', key: 'z2', zone: 'queue', label: 'Queue', n: 2 },
    { kind: 'item', key: 'i12', it: doing, depth: 0, band: '', foldable: true, folded: false, facts: facts({ code: 'F012', kids: { done: 1, all: 3 }, worker: { by: 'claude-code', tip: 'Claude Code is on it', quiet: false } }), look: look(desk) },
    { kind: 'hidden-kids', key: 'h12', parent: 12, depth: 1, open: false, later: 1, done: 1 },
    { kind: 'held', key: 'held9', it: item({ n: 9, status: 'done', title: 'Undo puts the row back' }), code: 'F009', said: 'Done', height: 56 },
    { kind: 'item', key: 'i14', it: open, depth: 0, band: '', foldable: false, folded: false, facts: facts({ code: 'F014', next: true }), look: look(desk) },
    { kind: 'zone', key: 'z3', zone: 'closed', label: 'Finished', n: 1 },
    { kind: 'item', key: 'i15', it: done, depth: 0, band: '', foldable: false, folded: false, facts: facts({ code: 'F015' }), look: look(desk) },
    { kind: 'archive-all', key: 'aa', n: 1 },
  ]
}

/** The list with its views: what needs you, the queue with a held row and folded subitems, finished work. */
export const List: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={460} height={900}>
      {(layout) => (
        <div className="flex h-full flex-col">
          <ItemList loading={false} views={views} rows={rows(layout === 'desk')} on={on} />
        </div>
      )}
    </Frames>
  ),
}

/** Before its data comes; and empty, for each reason. */
export const LoadingAndEmpty: Story = {
  render: () => (
    <Frames phoneWidth={393} deskWidth={460}>
      {() => (
        <div className="flex flex-col divide-y divide-dashed divide-zinc-300">
          <div className="flex h-32 flex-col"><ItemList loading views={null} rows={[]} on={on} /></div>
          {(['no-items', 'none', 'no-match', 'no-rules', 'nothing-archived', 'empty'] as const).map((why) => (
            <div key={why} className="flex flex-col">
              <ItemList loading={false} views={null} rows={[]} on={on} empty={<EmptyList why={why} status="wait" organizerOn={false} onReset={() => {}} onConnect={() => {}} />} />
            </div>
          ))}
        </div>
      )}
    </Frames>
  ),
}
