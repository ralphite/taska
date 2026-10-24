import type { Meta, StoryObj } from '@storybook/react-vite'
import type { LogSentence } from '../../model/activity'
import { Frame } from '../../stories/Frames'
import { ActivityList, DeletedList, DeletedView, DocsList, SideFrame, type ActivityRow, type DocRow, type GoneRow } from './SideLists'

const meta: Meta = { title: 'Components/Side lists' }
export default meta
type Story = StoryObj

const docs: DocRow[] = [
  { d: 12, title: 'The rewrite plan', web: false, on: 'F581 Rewrite Taska from scratch', comments: 3 },
  { d: 11, title: 'How the old page looks', web: true, on: 'F581 Rewrite Taska from scratch', comments: 0 },
  { d: 4, title: 'A document whose title is far too long to fit on one line of the list', web: false, on: '', comments: 1 },
]
const line = (key: string, who: string, parts: LogSentence['parts'], time = '10-23 14:30', session = ''): LogSentence => ({ key, who, session, parts, time })
const log: ActivityRow[] = [
  { s: line('#120', 'You', [{ n: 12, code: 'F12' }, ' Open → Done']), opens: true, undo: 120 },
  { s: line('#119', 'Claude Code', ['progress: ', { n: 12, code: 'F12' }, ' the list is in'], '10-23 14:12', 'taska rewrite'), opens: true, undo: null },
  { s: line('#118', 'Organizer', ['filed ', { id: 'r315', code: '#315' }, ': made F12, a feature (P1): Rewrite']), opens: true, undo: null },
  { s: line('#117', 'You', ['saw #311, #312']), opens: false, undo: null },
]
const gone: GoneRow[] = [
  { key: 'B07', kind: 'item', title: 'The drawer jumps', what: 'Item, with 2 subitems', at: '14:02' },
  { key: 'D3', kind: 'doc', title: 'Old notes', what: 'Document on F12', at: 'Yesterday 09:15' },
  { key: 'r301', kind: 'input', id: 'r301', text: 'the drawer jumps when I open it on the phone, and the list behind it moves too', code: '#301', with: 'B07', at: 'Oct 20' },
]
const on = { item() {}, input() {}, open() {}, undo() {}, more() {} }

const column = (children: React.ReactNode, side: 'docs' | 'log' | 'deleted', count = 0) => (
  <div className="flex gap-6">
    {(['light', 'dark'] as const).map((theme) => (
      <Frame key={theme} layout="desk" theme={theme} width={420} height={420}>
        <SideFrame side={side} count={count}>
          {children}
        </SideFrame>
      </Frame>
    ))}
  </div>
)

/** Every document, the newest first; the one open beside the list is lit. */
export const Documents: Story = { render: () => column(<DocsList docs={docs} open={12} onOpen={() => {}} />, 'docs', 3) }
export const NoDocuments: Story = { render: () => column(<DocsList docs={[]} open={null} onOpen={() => {}} />, 'docs') }

/** The change log as sentences; one of your changes has Undo (shown on hover); the picked line is lit. */
export const Activity: Story = { render: () => column(<ActivityList rows={log} end picked="#119" on={on} />, 'log') }
export const ActivityLoading: Story = { render: () => column(<ActivityList rows={null} end={false} picked={null} on={on} />, 'log') }
export const NoActivity: Story = { render: () => column(<ActivityList rows={[]} end picked={null} on={on} />, 'log') }

/** Everything deleted, the latest first: an item, a document, an input. */
export const Deleted: Story = { render: () => column(<DeletedList rows={gone} picked="D3" on={{ show() {}, restore() {} }} />, 'deleted', 3) }
export const NothingDeleted: Story = { render: () => column(<DeletedList rows={[]} picked={null} on={{ show() {}, restore() {} }} />, 'deleted') }

/** A deleted thing picked in Deleted, in the pane: an item, and an input. */
export const DeletedPicked: Story = {
  render: () => (
    <div className="flex gap-6">
      {[gone[0], gone[2]].map((x) => (
        <Frame key={x.key} layout="desk" width={560} height={300}>
          <DeletedView x={x} onRestore={() => {}} />
        </Frame>
      ))}
    </div>
  ),
}
