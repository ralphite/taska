// A row swiped on the phone: forward to its next step, back to the others.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { agent, swiped } from '../../stories/itemRowFixtures'

export default { title: 'Components/Item list/Item row/Swiping on the phone' } satisfies Meta
type Story = StoryObj

export const SwipingForward: Story = { ...swiped({ it: { status: 'doing', agent } }, 140), name: 'Swiping forward' }
export const SwipingBack: Story = { ...swiped({ it: { status: 'review' } }, -160), name: 'Swiping back' }
