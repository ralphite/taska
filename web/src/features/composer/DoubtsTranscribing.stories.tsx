// A voice note being written out, trying again, and its words in the box.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { voice } from '../../stories/doubtsFixtures'

export default { title: 'UI/Input box/Voice/Writing it out' } satisfies Meta
type Story = StoryObj

export const Transcribing = voice({ tr: '', transcribing: true })
export const TranscribedItsWordsInTheBox: Story = { ...voice({ tr: 'Keep the sort too.' }, 'Keep the sort too.'), name: 'Transcribed, its words in the box' }
