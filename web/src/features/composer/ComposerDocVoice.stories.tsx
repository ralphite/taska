// A comment spoken: recording, being written out, its words in the box.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VOICE } from '../../stories/boxFixtures'
import { at, one } from '../../stories/composerDocFixtures'

export default { title: 'Components/Input box/Commenting on a document/Speaking a comment' } satisfies Meta
type Story = StoryObj

export const PickedRecording: Story = { ...at({ ...one, rec: true }), name: 'Recording' }
export const PickedTranscribing: Story = { ...at({ ...one, files: [{ ...VOICE, tr: '', transcribing: true }] }), name: 'Being written out' }
export const PickedVoiceWords: Story = { ...at({ ...one, text: 'Keep the sort too.', files: [{ ...VOICE, tr: 'Keep the sort too.' }] }), name: "Picked, its voice note's words in the box" }
