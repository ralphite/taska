// Your message once it is sent: as it shows, its ⋯ under the pointer (Delete is in it), read by the agent.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, at, mine } from '../../stories/fromYouFixtures'

export default { title: 'UI/Item pane/Talk/Message/From you/Sent' } satisfies Meta
type Story = StoryObj

export const YourWords: Story = { ...at([mine()]), name: 'Sent' }
/** The desktop: the pointer on it shows its ⋯ (Edit, Add more and the rest), as on an agent's. */
export const PointerOnIt: Story = { ...at([mine()]), name: 'Pointer on it: ⋯ shows', parameters: { pseudo: { hover: ['.group\\/msg'] } } }
export const ReadByTheAgent: Story = { ...at([mine()], {}, { readBy: { 'claude-code': Date.parse(T) + 30_000 } }), name: 'Read by the agent' }
