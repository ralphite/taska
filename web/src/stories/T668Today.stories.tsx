// T668, a prototype: today's page, to compare with the options: your voice note under the bubble, in the grey line
// with the time; nothing heard, "Voice note" in the bubble.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TODAY, walk } from './t668Voice'

export default { title: 'Prototype/T668 Voice in your bubble/Today' } satisfies Meta

export const WalkThrough: StoryObj = { ...walk(TODAY), name: 'Walk through' }
