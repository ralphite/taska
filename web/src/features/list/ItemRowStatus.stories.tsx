// An item's row in each status it can be in, from open to archived, and a rule's row. The page's own ItemRow with that state's data, on the phone and the desktop.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { message } from '../../stories/fixtures'
import { agent, one } from '../../stories/itemRowFixtures'

export default { title: 'Components/Item list/Item row/By status' } satisfies Meta
type Story = StoryObj

export const Open = one({})
export const NextInTheQueue = one({ f: { next: true } })
export const InProgress = one({ it: { status: 'doing', agent }, f: { worker: { by: 'claude-code', tip: 'Claude Code is on it' }, talk: 4 } })
export const WaitsForReview = one({ it: { status: 'review' } })
export const YourAgentsTurn: Story = { ...one({ it: { talked: true, thread: [message({ id: 3, by: 'you', kind: 'say' })] }, f: { talk: 1 } }), name: 'Open, you replied' }
export const Done = one({ it: { status: 'done' } })
export const WontDo: Story = { ...one({ it: { status: 'dropped' } }), name: 'Won’t do' }
export const Archived = one({ it: { status: 'done', archived: true } })
export const Later = one({ it: { when: 'later', pri: 'P3' } })
export const Rule = one({ it: { type: 'rule', title: 'Commit messages are in English' }, f: { code: 'R012' } })
