// Searching every project (the Finder's search, as ⌘K and the phone's): what was found, nothing found, the next words
// being asked, Taska refusing or out of reach (T728 #7: each its own phase).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { answer, shown } from '../../stories/homeFixtures'

export default { title: 'UI/Home page/Searching' } satisfies Meta
type Story = StoryObj

/** Words typed in the search: what was found in every project (an item, a done one, an input). */
export const Searching: Story = { render: () => shown({ q: 'rewrite', search: { phase: 'found', answer } }) }

/** The search found nothing. */
export const NothingFound: Story = { name: 'Nothing found', render: () => shown({ q: 'zebra', search: { phase: 'nothing', answer: null } }, 420) }

/** More words typed: the last answer, faded, until the new one comes. */
export const Asking: Story = { name: 'Asking again', render: () => shown({ q: 'rewrite th', search: { phase: 'searching', answer } }) }

/** Taska refused the search. */
export const Failed: Story = { name: 'Search failed', render: () => shown({ q: 'rewrite', search: { phase: 'failed', answer: null } }, 420) }

/** Taska out of reach: asked again until it answers. */
export const Retrying: Story = { name: 'Taska out of reach', render: () => shown({ q: 'rewrite', search: { phase: 'offline', answer: null } }, 420) }
