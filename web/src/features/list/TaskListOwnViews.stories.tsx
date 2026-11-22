// The task list in your own views (made from filters, named by you) and sorted by time: one list with no groups.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PROJECT } from '../../stories/listFixtures'
import { bugs, view } from '../../stories/taskListFixtures'

export default { title: 'UI/List pane/Views/Your own views, sorting' } satisfies Meta
type Story = StoryObj

export const YourOwnViews: Story = { ...view('tasks', { tag: 'bug' }, PROJECT, [bugs, { name: 'Later ideas', tag: 'all', when: 'later', status: 'all', pri: 'all', sort: 'all' }]), name: 'Your own views' }
export const SortedNewest: Story = { ...view('tasks', { status: 'all', sort: 'new' }), name: 'Sorted: newest first' }
export const SortedLastUpdated: Story = { ...view('tasks', { status: 'all', sort: 'upd' }), name: 'Sorted: last updated' }
