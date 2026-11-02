// Settings' Organizer: on and off.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'

export default { title: 'Components/Settings/Organizer' } satisfies Meta
type Story = StoryObj

export const Organizer: Story = { ...one('organizer'), name: 'Organizer' }
export const OrganizerOff: Story = { ...one('organizer', { organizerOff: true }), name: 'Organizer: off' }
