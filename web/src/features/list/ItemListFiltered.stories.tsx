// The item list filtered: the page's own steps; the filters set show above the rows.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ListQuery } from '../../model/route'
import { Frames } from '../../stories/Frames'
import { PROJECT, listOf } from '../../stories/listFixtures'

export default { title: 'UI/List pane/Views/Filtered' } satisfies Meta
type Story = StoryObj

const at = (q: Partial<ListQuery>): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={460} height={620}>{(layout) => listOf(PROJECT, 'items', q, layout === 'desk', { filters: true })}</Frames>,
})

export const Filtered: Story = { ...at({ type: 'bug', pri: 'P0' }), name: 'Filtered: bugs, P0' }
