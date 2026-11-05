// The item's pane while its item is loading, when it is not in this project or Taska is out of reach, and with nothing
// picked beside Documents or Activity.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { PaneFrame } from '../../ui/PaneFrame'
import { Missing, NoSelection } from './ItemPage'
import { act } from '../../stories/acts'

export default { title: 'Components/Item page/Loading and empty' } satisfies Meta
type Story = StoryObj

/** An item the address names, not here (yet): in the pane as the page draws it, its bar with the code (and Back on
 * the phone). */
const missing = (what: string, loading: boolean, away: boolean): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={720} height={260}>
      {(layout) => (
        <div className="flex h-full flex-col">
          <PaneFrame place="" desk={layout === 'desk'} head={<span className="font-mono text-sm font-bold">{what}</span>} onBack={act('Pane: back')}>
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
/** Nothing picked: the desktop's pane beside a side list (on the phone the list shows instead). */
const deskPane = (node: React.ReactNode): Story => ({ render: () => <Frames phone={false} deskWidth={720} height={260}>{() => node}</Frames> })
export const NothingPickedDocuments: Story = { ...deskPane(<NoSelection side="docs" />), name: 'Nothing picked: documents' }
export const NothingPickedActivity: Story = { ...deskPane(<NoSelection side="log" />), name: 'Nothing picked: activity' }
