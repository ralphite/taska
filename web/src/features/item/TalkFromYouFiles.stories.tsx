// Your message with pictures or a file, and long words cut on the desktop.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { LONG, at, later, message, mine, pdf, r4, shot } from '../../stories/fromYouFixtures'

export default { title: 'Components/Conversation/Message/From you/Pictures, files, long words' } satisfies Meta
type Story = StoryObj

export const WithPictures = at([mine()], { inputs: [r4({ files: [shot, { ...shot, f: 'f4-shot.png' }] })] })
export const WithAFile = at([mine()], { inputs: [r4({ files: [pdf] })] })
export const LongCutOnTheDesktop: Story = { ...at([mine({ text: LONG }), { ...message({ id: 2 }), t: later(3) }]), name: 'Long: cut on the desktop' }
