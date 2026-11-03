// An item's row once it is finished (done, won't do, archived), and a rule's row.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/itemRowFixtures'

export default { title: 'Components/Item list/Item row/By status/Finished, and rules' } satisfies Meta
type Story = StoryObj

export const Done = one({ it: { status: 'done' } })
export const WontDo: Story = { ...one({ it: { status: 'dropped' } }), name: 'Won’t do' }
export const Archived = one({ it: { status: 'done', archived: true } })
export const Rule = one({ it: { type: 'rule', title: 'Commit messages are in English' }, f: { code: 'R012' } })
