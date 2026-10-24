import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frame } from '../../stories/Frames'
import { PROJECT_TONES } from '../../ui/tones'
import { DeletedBody, DocsBody, LogBody, PhoneProjectsBody } from './PhoneSections'

const meta: Meta = { title: 'Components/Settings/Phone pages' }
export default meta
type Story = StoryObj

const no = () => {}
const phone = (body: React.ReactNode, height = 640) => (
  <Frame layout="phone" width={393} height={height}>
    <div className="h-full overflow-y-auto bg-zinc-100 dark:bg-zinc-950">{body}</div>
  </Frame>
)

/** Projects in grouped rows, one row's actions open, a deleted one. */
export const Projects: Story = {
  render: () =>
    phone(
      <PhoneProjectsBody
        f={{ live: [{ name: 'taska', title: 'taska', tone: PROJECT_TONES[4], open: 32, here: true }, { name: 'home', title: 'Home', tone: PROJECT_TONES[0], open: 13, here: false }], gone: [{ name: 'old', title: 'Old notes', when: 'Oct 20', items: 4 }], file: '', pNew: false, pNewText: '', pErr: '', renaming: null, purging: new Set(), menu: 'home' }}
        on={{ newProject: no, create: no, rename: no, saveRename: no, remove: no, restore: no, purge: no, menu: no, open: no }}
      />,
    ),
}

/** Documents, Activity and Deleted as the phone's pages. */
export const Lists: Story = {
  render: () => (
    <div className="flex gap-6">
      {phone(<div className="mx-3 mt-4 rounded-2xl bg-white px-4 dark:bg-zinc-900"><DocsBody docs={[{ d: 12, title: 'The rewrite plan', web: false, on: 'F012 Rewrite', comments: 3 }]} onOpen={no} /></div>, 300)}
      {phone(<div className="mx-3 mt-4 rounded-2xl bg-white px-4 dark:bg-zinc-900"><LogBody rows={[{ s: { key: '#1', who: 'You', session: '', parts: ['F12 Open → Done'], time: '10-23 14:30' }, undo: 1 }]} end asking={new Set()} on={{ item: no, input: no, undo: no, more: no }} /></div>, 300)}
      {phone(<div className="mx-3 mt-4 rounded-2xl bg-white px-4 dark:bg-zinc-900"><DeletedBody things={[{ label: 'B07', title: 'The drawer jumps', what: 'Item', at: '14:02' }]} inputs={[{ id: 'r301', code: '#301', t: 'Oct 20', at: 'Oct 21', text: 'the drawer jumps', items: [] }]} on={{ restore: no, restoreInput: no }} /></div>, 400)}
    </div>
  ),
}
