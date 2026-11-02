// The line while what you sent is handled: being written out, organized, waiting for an agent, left for one.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, org, sent } from '../../stories/composerSentFixtures'

export default { title: 'Components/Input box/Line after sending/Being handled' } satisfies Meta
type Story = StoryObj

export const SentTranscribing: Story = { ...at({ sent: sent({ text: '', trWait: true }) }), name: 'Sent, transcribing' }
export const SentOrganizing: Story = { ...at({ sent: sent(), organizer: true }), name: 'Sent, organizing' }
export const SentWaitingForYourAgent: Story = { ...at({ sent: sent() }), name: 'Sent, waiting for agent' }
export const SentLeftForYourAgent: Story = { ...at({ sent: sent({ org: org(true, 'Left for your coding agent') }), organizer: true }), name: 'Sent, left for agent' }
