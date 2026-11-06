// What such a row can carry: later and part of another item, a draft.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { item } from '../../stories/fixtures'
import { listOf } from '../../stories/listFixtures'
import { one, question, row } from '../../stories/needsYouRowFixtures'
import { one as tipOne } from '../../stories/tipFixtures'

export default { title: 'Components/Item list/Needs-you row/What it shows' } satisfies Meta
type Story = StoryObj

export const LaterPartOfAnother: Story = { ...one({ it: { n: 14, status: 'proposed', when: 'later', parent: 3 }, excerpt: 'Split from F003', f: { code: 'F014', parentCode: 'F003' } }), name: 'Later, part of another item' }
// ---- more states (B636)
export const WithADraft: Story = { ...one({ ...question, f: { draft: true } }), name: 'With a draft' }
// ---- more states (T639)
/** in Active, a subitem that needs you stays under its parent, indented */
export const AsASubitem: Story = {
  name: 'As a subitem, under its parent',
  render: () => <Frames phoneWidth={393} deskWidth={460} height={420}>{(layout) => listOf([item({ n: 1, status: 'doing', title: 'Export keeps the filter you set' }), item({ n: 14, type: 'task', parent: 1, title: 'Which file name?', wait: { id: 4, kind: 'ask', text: 'Put the date in the file name?', by: 'claude-code', files: [] } })], 'items', { status: 'all' }, layout === 'desk')}</Frames>,
}
// ---- a narrow list (B678): the action is its icon, its name in the tip
const narrow = (desk: boolean) => (
  <div className="@container/list w-[340px]">
    {row(question, desk)}
    {row({ it: { n: 13, status: 'proposed', by: 'claude-code', title: 'Keep the filter in the export file name' }, excerpt: 'Proposed by Claude Code', f: { code: 'F013' } }, desk)}
    {row({ it: { n: 14, status: 'review', title: 'Excel export as well' }, excerpt: 'Done: the export keeps the filter now', f: { code: 'F014' } }, desk)}
  </div>
)
/** in a list 340 wide (the page's list beside an item, a narrow window): Answer, Approve and Accept as their icons */
export const NarrowList: Story = { name: 'A narrow list: the actions as icons', render: () => <Frames phone={false} deskWidth={340} height={260}>{() => narrow(true)}</Frames> }
/** the pointer on one of them: its name and key in the tip */
export const NarrowListTip: Story = { ...tipOne(narrow, '[data-need="approve"]', { width: 440, height: 260 }), name: 'A narrow list: the tip on an action' }
