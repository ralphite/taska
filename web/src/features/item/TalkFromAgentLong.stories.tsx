// A long message: cut with Show all, pressed to open, opened with Show less; the latest message whole however long.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { LONG, after, at } from '../../stories/talkFromAgentFixtures'

export default { title: 'Components/Conversation/Message/From an agent/Long messages' } satisfies Meta
type Story = StoryObj

export const LongCutShowAll: Story = { ...at(after(message({ id: 2, text: LONG }))), name: 'Long: cut, Show all' }
export const LongPressedToOpen: Story = { ...at(after(message({ id: 2, text: LONG }))), name: 'Long: pressed to open', parameters: { pseudo: { active: ['button[data-more]'] } } }
export const LongOpenedShowLess: Story = { ...at(after(message({ id: 2, text: LONG })), { env: { opened: new Set([2]) } }), name: 'Long: opened, Show less' }
export const LatestMessageWhole: Story = { ...at([message({ id: 2, text: LONG })]), name: 'Latest message: whole however long' }
