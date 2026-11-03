// Searching Help: what it finds, nothing found, words typed while a topic is open.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { help } from '../../stories/helpFixtures'

export default { title: 'Components/Settings, help and parts/Help/Searching' } satisfies Meta
type Story = StoryObj

export const Searching: Story = { ...help(null, 'agent', { menu: true }), name: 'What it finds' }
export const NothingFound: Story = { ...help(null, 'invoice', { menu: true }), name: 'Nothing found' }
/** words typed while a topic is open: Search results take the topic's place, the topic stays marked in the column */
export const SearchingFromATopic: Story = { ...help('connect', 'phone', { menu: true }), name: 'Searching from a topic' }
