// The box writing a new input: the New input page, with words, and the organizer off (its line says an agent files it).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, words } from '../../stories/composerFixtures'

export default { title: 'Components/Input box/What it writes to/A new input' } satisfies Meta
type Story = StoryObj

export const ANewInputTheNewInputPage: Story = { ...at({ at: 'new', composePage: true }), name: 'Empty (the New input page)' }
export const ANewInputWithWords: Story = { ...at({ at: '', text: words }), name: 'With words' }
export const ANewInputOrganizerOff: Story = { ...at({ at: '', organizer: false }), name: 'Organizer off' }
