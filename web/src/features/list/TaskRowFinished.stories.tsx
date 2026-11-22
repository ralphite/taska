// A task's row once it is finished (done, won't do, archived).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/taskRowFixtures'

export default { title: 'UI/List pane/Task row/By status/Finished' } satisfies Meta
type Story = StoryObj

export const Done = one({ it: { status: 'done' } })
export const WontDo: Story = { ...one({ it: { status: 'dropped' } }), name: "Won't do" }
export const Archived = one({ it: { status: 'done', archived: true } })
