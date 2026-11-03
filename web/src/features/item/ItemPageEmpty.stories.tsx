// The item's pane while its item is loading, when it is not in this project or Taska is out of reach, and with nothing
// picked (beside the items, Documents or Activity).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { PaneFrame } from '../../ui/PaneFrame'
import { Missing, NoSelection } from './ItemPage'

export default { title: 'Components/Item page/Loading and empty' } satisfies Meta
type Story = StoryObj

const pane = (node: React.ReactNode): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={720} height={260}>{() => node}</Frames> })
/** An item the address names, not here (yet): in the pane as the page draws it, its bar with the code (and Back on
 * the phone). */
const missing = (what: string, loading: boolean, away: boolean): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={720} height={260}>
      {(layout) => (
        <div className="flex h-full flex-col">
          <PaneFrame place="" desk={layout === 'desk'} head={<span className="font-mono text-sm font-bold">{what}</span>} onBack={() => {}}>
            <Missing what={what} loading={loading} away={away} />
          </PaneFrame>
        </div>
      )}
    </Frames>
  ),
})

export const LoadingAfterAReload: Story = { ...missing('F012', true, false), name: 'Loading (after a reload)' }
export const TaskaOutOfReach: Story = { ...missing('F012', true, true), name: 'Taska out of reach' }
export const NotInThisProject: Story = { ...missing('F099', false, false), name: 'Not in this project' }
export const NothingPicked: Story = { ...pane(<NoSelection side={null} />), name: 'Nothing picked' }
export const NothingPickedDocuments: Story = { ...pane(<NoSelection side="docs" />), name: 'Nothing picked: documents' }
export const NothingPickedActivity: Story = { ...pane(<NoSelection side="log" />), name: 'Nothing picked: activity' }
