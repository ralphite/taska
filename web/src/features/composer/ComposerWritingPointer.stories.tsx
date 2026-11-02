// The pointer on the mic, on Send, on + (add pictures or files).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at } from '../../stories/composerWritingFixtures'

export default { title: 'Components/Input box/Writing/Pointer on its buttons' } satisfies Meta
type Story = StoryObj

export const PointingAtTheMic = at({}, { hover: ['[aria-label="Record a voice note"]'] })
export const PointingAtSend = at({ text: 'Buy milk on the way home' }, { hover: ['[data-box="main"]'] })
export const PointingAtAdd: Story = { ...at({}, { hover: ['[aria-label="Add files"]'] }), name: 'Pointing at + (add pictures or files)' }
