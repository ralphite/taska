// A voice note recording: in the box, pointing at the check, from the second mic.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { boxAt } from '../../stories/boxFixtures'
import { recording } from '../../stories/doubtsFixtures'

export default { title: 'UI/Input box/Voice/Recording' } satisfies Meta
type Story = StoryObj

export const Recording = recording()
export const RecordingPointingAtTheCheck: Story = { ...recording({ hover: ['[aria-label="Stop and put words in the box"]'] }), name: 'Pointing at the check' }
// ---- more states (B636)
export const RecordingFromTheSecondMic: Story = { name: 'From the second mic', render: () => <Frames phoneWidth={393} deskWidth={640}>{(layout) => boxAt({ rec: true, recAux: true }, layout === 'desk')}</Frames> }
