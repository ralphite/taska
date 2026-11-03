// The item's pane while its item is loading, when it is not in this project or Taska is out of reach, and with nothing
// picked (beside the items, Documents or Activity).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { Missing, NoSelection } from './ItemPage'

export default { title: 'Components/Item page/Loading and empty' } satisfies Meta
type Story = StoryObj

const pane = (node: React.ReactNode): Story => ({ render: () => <Frames phoneWidth={393} deskWidth={720} height={260}>{() => node}</Frames> })

export const LoadingAfterAReload: Story = { ...pane(<Missing what="F012" loading away={false} />), name: 'Loading (after a reload)' }
export const TaskaOutOfReach: Story = { ...pane(<Missing what="F012" loading away />), name: 'Taska out of reach' }
export const NotInThisProject: Story = { ...pane(<Missing what="F099" loading={false} away={false} />), name: 'Not in this project' }
export const NothingPicked: Story = { ...pane(<NoSelection side={null} />), name: 'Nothing picked' }
export const NothingPickedDocuments: Story = { ...pane(<NoSelection side="docs" />), name: 'Nothing picked: documents' }
export const NothingPickedActivity: Story = { ...pane(<NoSelection side="log" />), name: 'Nothing picked: activity' }
