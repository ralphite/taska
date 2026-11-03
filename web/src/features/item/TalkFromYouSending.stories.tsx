// Your message while it is being sent: going (Undo beside it), a picture still going up, Taska out of reach; and not
// sent, refused.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PICTURE } from '../../stories/fixtures'
import { at, mine, out } from '../../stories/fromYouFixtures'

export default { title: 'Components/Conversation/Message/From you/Sending, or not sent' } satisfies Meta
type Story = StoryObj

export const SendingWithUndo: Story = { ...at([mine()], out('Sending…', true)), name: 'Sending, with Undo' }
export const UploadingAPicture: Story = { ...at([mine()], out('Uploading…', false, [PICTURE])), name: 'A picture going up' }
export const WaitingForTaska: Story = { ...at([mine()], out('Waiting for Taska…')), name: 'Taska out of reach: waiting for it' }
export const NotSentRetryEdit: Story = { ...at([mine()], out('Not sent')), name: 'Not sent: Retry, Edit' }
