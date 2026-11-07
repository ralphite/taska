// An item's row once it is finished (done, won't do, archived).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/itemRowFixtures'

export default { title: 'UI/List pane/Item row/By status/Finished' } satisfies Meta
type Story = StoryObj

export const Done = one({ it: { status: 'done' } })
export const WontDo: Story = { ...one({ it: { status: 'dropped' } }), name: "Won't do" }
export const Archived = one({ it: { status: 'done', archived: true } })
