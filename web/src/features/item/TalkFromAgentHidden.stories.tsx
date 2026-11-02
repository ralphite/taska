// The pointer on a message, and a message hidden to one line and shown again.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { at } from '../../stories/talkFromAgentFixtures'

export default { title: 'Components/Conversation/Message/From an agent/Pointer and hidden' } satisfies Meta
type Story = StoryObj

export const PointerOnIt: Story = { ...at([message({ id: 2 })]), name: 'Pointer on it: ⋯ shows', parameters: { pseudo: { hover: ['.group'] } } }
export const HiddenOneLine: Story = { ...at([message({ id: 2, hidden: true })]), name: 'Hidden: one line' }
export const HiddenShownAgain: Story = { ...at([message({ id: 2, hidden: true })], { t: { peeking: new Set([2]) } }), name: 'Hidden, shown again' }
