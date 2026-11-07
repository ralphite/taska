// The item list in your own views (made from filters, named by you) and sorted by time: one list with no groups.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PROJECT } from '../../stories/listFixtures'
import { bugs, view } from '../../stories/itemListFixtures'

export default { title: 'UI/List pane/Views/Your own views, sorting' } satisfies Meta
type Story = StoryObj

export const YourOwnViews: Story = { ...view('items', { type: 'bug' }, PROJECT, [bugs, { name: 'Later ideas', type: 'idea', when: 'later', status: 'all', pri: 'all', sort: 'all' }]), name: 'Your own views' }
export const SortedNewest: Story = { ...view('items', { status: 'all', sort: 'new' }), name: 'Sorted: newest first' }
export const SortedLastUpdated: Story = { ...view('items', { status: 'all', sort: 'upd' }), name: 'Sorted: last updated' }
