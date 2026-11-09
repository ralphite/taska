// An item's row in each status before it is finished: open, next in the queue, in progress, waiting for your review,
// for later. The page's own ItemRow with that state's data, on the phone and the desktop.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { agent, one } from '../../stories/itemRowFixtures'

export default { title: 'UI/List pane/Item row/By status/Still to do' } satisfies Meta
type Story = StoryObj

export const Open = one({})
export const NextInTheQueue: Story = { ...one({ f: { next: true } }), name: 'Next in the queue' }
export const YourAgentsTurn: Story = { ...one({ it: { talked: true, thread: [message({ id: 3, by: 'you', kind: 'say' })] }, f: { talk: 1 } }), name: 'Open, you replied' }
const worker = { by: 'claude-code', tip: 'Claude Code is on it' }
/** its second line: what its agent last said, and how long ago (D115 #30) */
export const InProgress: Story = { ...one({ it: { status: 'doing', agent }, f: { worker, talk: 4, news: { text: 'Testing with three filters', age: '12m', quiet: false } } }), name: 'In progress' }
/** over an hour without news: the time in amber */
export const InProgressQuiet: Story = { ...one({ it: { status: 'doing', agent }, f: { worker, talk: 4, news: { text: 'Testing with three filters, then the sort and the export of every column', age: '2h', quiet: true } } }), name: 'In progress, no news for an hour' }
/** no agent has said anything on it yet */
export const InProgressNothingSaid: Story = { ...one({ it: { status: 'doing', agent }, f: { worker } }), name: 'In progress, nothing said yet' }
export const WaitsForReview: Story = { ...one({ it: { status: 'review' } }), name: 'Waits for review' }
export const Later = one({ it: { when: 'later', pri: 'P3' } })
/** Later until a day: the row says which (D115 #21) */
export const LaterUntilADay: Story = { ...one({ it: { when: 'later', pri: 'P3', later_until: '2026-10-26' }, f: { laterOn: 'Mon' } }), name: 'Later until a day' }
