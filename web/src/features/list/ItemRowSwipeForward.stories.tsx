// A row swiped forward on the phone (to the right): its next step, under the finger as it slides; let go past a third
// of the row and the step is taken.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { agent, swiped } from '../../stories/itemRowFixtures'
import { askOf } from '../../stories/needsCardFixtures'

export default { title: 'UI/List pane/Item row/Phone: Swiping/Forward' } satisfies Meta
type Story = StoryObj

export const SwipingForward: Story = { ...swiped({ it: { status: 'doing', agent } }, 140), name: 'In progress: Done' }
export const ForwardAnswer: Story = { ...swiped({ it: { wait: askOf('Which format should the export use?') } }, 140), name: 'A question: Answer' }
export const ForwardApprove: Story = { ...swiped({ it: { status: 'proposed', by: 'claude-code' } }, 140), name: 'A proposal: Approve' }
export const ForwardAccept: Story = { ...swiped({ it: { status: 'review' } }, 140), name: 'Finished work: Accept' }
export const ForwardSubitemsOpen: Story = { ...swiped({ it: { status: 'doing', agent }, f: { kids: { done: 1, all: 3 }, openKids: 2 }, foldable: true }, 140), name: 'Done, with subitems still open' }
export const FinishedForward: Story = { ...swiped({ it: { status: 'done' } }, 140), name: "Done or won't do: Archive" }
