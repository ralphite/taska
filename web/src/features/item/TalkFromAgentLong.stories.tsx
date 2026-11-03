// A long message: cut with Show all, pressed to open, opened with Show less; the latest message whole however long.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { LONG, after, at } from '../../stories/talkFromAgentFixtures'

export default { title: 'Components/Conversation/Message/From an agent/Long messages' } satisfies Meta
type Story = StoryObj

export const LongCutShowAll: Story = { ...at(after(message({ id: 2, text: LONG }))), name: 'Cut: Show all' }
export const LongPressedToOpen: Story = { ...at(after(message({ id: 2, text: LONG }))), name: 'Pressed to open', parameters: { pseudo: { active: ['button[data-more]'] } } }
export const LongOpenedShowLess: Story = { ...at(after(message({ id: 2, text: LONG })), { env: { opened: new Set([2]) } }), name: 'Opened: Show less' }
export const LatestMessageWhole: Story = { ...at([message({ id: 2, text: LONG })]), name: 'Latest message: whole however long' }
// ---- more states (T639)
const VERY_LONG = Array.from({ length: 60 }, (_, i) => `Line ${i + 1}: what the agent did, and why, in a few words.`).join('\n')
/** the latest message is shown whole up to 50 lines; past that it is cut after all */
export const LatestMessagePast50Lines: Story = { ...at([message({ id: 2, text: VERY_LONG })]), name: 'Latest message past 50 lines: cut after all' }
