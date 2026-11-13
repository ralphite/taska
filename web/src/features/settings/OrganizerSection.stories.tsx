// Settings' Organizer: on with its key set here or from the environment, off with no key (F765), a key being saved.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/sectionsFixtures'

export default { title: 'UI/Settings and help/Settings/Organizer' } satisfies Meta
type Story = StoryObj

export const Organizer: Story = { ...one('organizer'), name: 'On, the key set here' }
export const OrganizerEnv: Story = { ...one('organizer', { keyFrom: 'env' }), name: 'On, the key from GEMINI_API_KEY' }
export const OrganizerOff: Story = { ...one('organizer', { organizerOff: true }), name: 'Off: no key' }
export const OrganizerSaving: Story = { ...one('organizer', { organizerOff: true, keySaving: true }), name: 'Off: a key being checked' }
