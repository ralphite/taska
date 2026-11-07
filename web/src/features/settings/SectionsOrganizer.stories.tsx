// Settings' Organizer: on and off.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'

export default { title: 'UI/Settings and help/Settings/Organizer' } satisfies Meta
type Story = StoryObj

export const Organizer: Story = { ...one('organizer'), name: 'On' }
export const OrganizerOff: Story = { ...one('organizer', { organizerOff: true }), name: 'Off' }
