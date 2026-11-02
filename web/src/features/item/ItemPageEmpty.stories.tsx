// The item's pane while its item is loading, when it is not in this project, and with nothing picked.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
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
