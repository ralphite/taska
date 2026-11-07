// The box writing a new input: the New input page, empty and with words.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, words } from '../../stories/composerFixtures'

export default { title: 'UI/Input box/What it writes to/A new input' } satisfies Meta
type Story = StoryObj

export const ANewInputTheNewInputPage: Story = { ...at({ at: 'new' }), name: 'Empty (the New input page)' }
export const ANewInputWithWords: Story = { ...at({ at: '', text: words }), name: 'With words' }
