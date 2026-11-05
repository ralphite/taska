// The line under the box while what you sent is on its way: sending, uploading, several at once, waiting for Taska, not
// sent. Its × cancels what it names: it is not sent (B666).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { out } from '../../stories/boxFixtures'
import { at } from '../../stories/composerSentFixtures'

export default { title: 'Components/Input box/Line after sending/On its way' } satisfies Meta
type Story = StoryObj

export const Sending = at({ mine: [out()] })
export const UploadingThenSending: Story = { ...at({ mine: [out({ text: '', files: [{ f: '', name: 'shot.png', mime: 'image/png', uploading: true }] })] }), name: 'Uploading' }
export const SeveralOnTheirWay: Story = { ...at({ mine: [out(), out({ q: 'q2', text: 'And bread' }), out({ q: 'q3', text: 'And eggs' })] }), name: 'Several on their way' }
export const WaitingForTaska: Story = { ...at({ mine: [out({ state: 'failed', net: true })] }), name: 'Taska out of reach: waiting for it' }
// ---- more states (B636)
export const NotSent: Story = { ...at({ mine: [out({ state: 'failed' })] }), name: 'Not sent' }
