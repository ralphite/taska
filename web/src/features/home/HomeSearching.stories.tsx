// Searching every project, and nothing found.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { hits, shown } from '../../stories/homeFixtures'

export default { title: 'UI/Home page/Searching' } satisfies Meta
type Story = StoryObj

/** Words typed in the search: what was found in every project (an item, a done one, an input). */
export const Searching: Story = { render: () => shown({ q: 'rewrite', hits }) }

/** The search found nothing. */
export const NothingFound: Story = { name: 'Nothing found', render: () => shown({ q: 'zebra', hits: [] }, 420) }
