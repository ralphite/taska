// A comment spoken: recording, being written out, its words in the box.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VOICE } from '../../stories/boxFixtures'
import { at, one } from '../../stories/composerDocFixtures'

export default { title: 'UI/Input box/Commenting on a document/Speaking a comment' } satisfies Meta
type Story = StoryObj

export const PickedRecording: Story = { ...at({ ...one, rec: true }), name: 'Recording' }
export const PickedTranscribing: Story = { ...at({ ...one, files: [{ ...VOICE, transcript: 'wait' }] }), name: 'Being written out' }
export const PickedVoiceWords: Story = { ...at({ ...one, text: 'Keep the sort too.', files: [VOICE] }), name: "Picked, its voice note's words in the box" }
