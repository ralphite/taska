// Your message, sent: as it shows once sent, while it goes, the moment Undo can take it back, read by the agent.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, at, mine, out } from '../../stories/fromYouFixtures'

export default { title: 'Components/Conversation/Message/From you/Sent' } satisfies Meta
type Story = StoryObj

export const YourWords = at([mine()])
export const SendingWithUndo: Story = { ...at([mine()], out('Sending…', false, true)), name: 'Sending, with Undo' }
export const JustSentUndo: Story = { ...at([mine()], { t: { undo: (rid) => (rid === 'r4' ? 'q1' : null) } }), name: 'Just sent: Undo' }
export const ReadByTheAgent = at([mine()], {}, { readBy: { 'claude-code': Date.parse(T) + 30_000 } })
