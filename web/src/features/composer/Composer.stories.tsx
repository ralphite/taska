// The box writing a new input: the New input page, with words, with the organizer on.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, words } from '../../stories/composerFixtures'

export default { title: 'Components/Input box/What it writes to/A new input' } satisfies Meta
type Story = StoryObj

export const ANewInputTheNewInputPage: Story = { ...at({ at: 'new', composePage: true }), name: 'Empty (the New input page)' }
export const ANewInputWithWords: Story = { ...at({ at: '', text: words }), name: 'With words' }
export const ANewInputOrganizerOn: Story = { ...at({ at: '', organizer: true }), name: 'Organizer on' }
