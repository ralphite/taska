// The item's pane while its item is loading, when it is not in this project, and with nothing picked.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frames } from '../../stories/Frames'
import { Icon } from '../../ui/Icon'
import { PaneFrame } from '../../ui/PaneFrame'
import { BackTo, Missing, NoSelection } from './ItemPage'

export default { title: 'Components/Item page/Loading and empty' } satisfies Meta
type Story = StoryObj

const pane = (node: React.ReactNode): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={720} height={260}>{() => node}</Frames> })

export const LoadingAfterAReload: Story = { ...pane(<Missing what="F012" loading away={false} />), name: 'Loading (after a reload)' }
export const NotInThisProject = pane(<Missing what="F099" loading={false} away={false} />)
export const NothingPicked = pane(<NoSelection side={null} />)
// ---- more states (B636)
export const TaskaOutOfReach: Story = { ...pane(<Missing what="F012" loading away />), name: 'Taska out of reach' }
export const NothingPickedDocuments: Story = { ...pane(<NoSelection side="docs" />), name: 'Nothing picked: documents' }
export const NothingPickedActivity: Story = { ...pane(<NoSelection side="log" />), name: 'Nothing picked: activity' }
export const BackToAnItem: Story = { ...pane(<BackTo label="F012" onBack={() => {}} />), name: 'Back to an item' }
// ---- more states (T639): the pane's bar as the page draws it
const newInputHead = (
  <span className="flex items-center gap-2 text-sm font-semibold">
    <Icon n="newinput" c="size-[18px] text-blue-600 dark:text-blue-400" />
    New input
  </span>
)
const frame = (props: Partial<Parameters<typeof PaneFrame>[0]>, desk: boolean) => (
  <div className="flex h-56 flex-col">
    <PaneFrame place="" desk={desk} onBack={() => {}} {...props}>
      <p className="px-8 py-4 text-[15px]">The page goes here.</p>
    </PaneFrame>
  </div>
)
/** New input opened from an item: its bar says New input and, at its end, the way back to that item */
export const NewInputFromAnItem: Story = { name: 'New input, opened from an item: Back to F012', render: () => <Frames phone={false} deskWidth={720}>{() => frame({ head: newInputHead, nav: <BackTo label="F012" onBack={() => {}} /> }, true)}</Frames> }
/** a side list open on the desktop and nothing picked: the pane has no bar */
export const NoBarBesideASideList: Story = { name: 'Beside a side list: no bar', render: () => <Frames phone={false} deskWidth={720}>{() => frame({ bar: false, children: <NoSelection side="docs" /> }, true)}</Frames> }
/** the phone's Back and ⋯ pressed */
export const PhonePressed: Story = {
  name: 'Back and ⋯ pressed (phone)',
  render: () => (
    <Frames desk={false} phoneWidth={393}>
      {() => <After run={(root) => root.querySelectorAll('header button').forEach((b) => b.setAttribute('data-pressed', ''))}>{frame({ head: <span className="font-mono text-sm font-bold">F012</span>, menu: true, onMenu: () => {} }, false)}</After>}
    </Frames>
  ),
}
