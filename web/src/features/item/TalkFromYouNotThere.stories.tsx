// Your message, not there yet: a picture still going up, Taska out of reach, refused.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { at, mine, out } from '../../stories/fromYouFixtures'

export default { title: 'Components/Conversation/Message/From you/Not there yet' } satisfies Meta
type Story = StoryObj

export const UploadingAPicture = at([mine()], out('Uploading…'))
export const WaitingForTaska = at([mine()], out('Waiting for Taska…'))
export const NotSentRetryEdit: Story = { ...at([mine()], out('Not sent')), name: 'Not sent: Retry, Edit' }
