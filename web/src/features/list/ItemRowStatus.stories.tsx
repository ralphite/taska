// An item's row in each status before it is finished: open, next in the queue, in progress, waiting for your review,
// for later. The page's own ItemRow with that state's data, on the phone and the desktop.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { agent, one } from '../../stories/itemRowFixtures'

export default { title: 'Components/Item list/Item row/By status/Still to do' } satisfies Meta
type Story = StoryObj

export const Open = one({})
export const NextInTheQueue: Story = { ...one({ f: { next: true } }), name: 'Next in the queue' }
export const YourAgentsTurn: Story = { ...one({ it: { talked: true, thread: [message({ id: 3, by: 'you', kind: 'say' })] }, f: { talk: 1 } }), name: 'Open, you replied' }
export const InProgress: Story = { ...one({ it: { status: 'doing', agent }, f: { worker: { by: 'claude-code', tip: 'Claude Code is on it' }, talk: 4 } }), name: 'In progress' }
export const WaitsForReview: Story = { ...one({ it: { status: 'review' } }), name: 'Waits for review' }
export const Later = one({ it: { when: 'later', pri: 'P3' } })
