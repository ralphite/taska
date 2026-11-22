// A row with subtasks, folded or not, a subtask, and a task that is part of another one shown on its own.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/taskRowFixtures'

export default { title: 'UI/List pane/Task row/Subtasks' } satisfies Meta
type Story = StoryObj

export const WithSubtasks: Story = { ...one({ foldable: true, f: { kids: { done: 3, all: 8 } } }), name: 'With subtasks' }
export const WithSubtasksFolded: Story = { ...one({ foldable: true, folded: true, f: { kids: { done: 3, all: 8 } } }), name: 'With subtasks, folded' }
export const Subtask = one({ depth: 1, it: { n: 14, parent: 3, title: 'Keep the filter in the export file name' }, f: { code: 'T014' } })
export const PartOfAnother: Story = { ...one({ it: { n: 14, parent: 3 }, f: { code: 'T014', parentCode: 'T003' } }), name: 'Part of another task (not under it here)' }
