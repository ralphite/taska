// The line while what you sent is handled: being written out, organized, left for an agent; waiting for one with the
// organizer off.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, org, sent } from '../../stories/composerSentFixtures'
import { shown, waiting } from '../../stories/fixtures'

export default { title: 'Components/Input box/Line after sending/Being handled' } satisfies Meta
type Story = StoryObj

export const SentTranscribing: Story = { ...at({ sent: shown(sent({ text: '', files: [{ f: 'f9-voice_0-06.webm', name: 'voice_0-06.webm', mime: 'audio/webm' }] }), waiting('f9-voice_0-06.webm')) }), name: 'Sent, transcribing' }
export const SentOrganizing: Story = { ...at({ sent: sent() }), name: 'Sent, organizing' }
export const SentLeftForYourAgent: Story = { ...at({ sent: sent({ org: { ...org(true, 'Left for agent'), keep: true, changed: false } }) }), name: 'Sent, left for agent' }
export const SentWaitingForYourAgent: Story = { ...at({ sent: sent(), organizer: false }), name: 'Sent, waiting for agent: organizer off' }
