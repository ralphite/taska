// The box replying on a task, with words, and recording for another task.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { scopeDraft } from '../../model/draftTarget'
import { at, words } from '../../stories/composerFixtures'

export default { title: 'UI/Input box/What it writes to/A reply to a task' } satisfies Meta
type Story = StoryObj

export const AReplyToAnTask: Story = { ...at({ at: 'T012' }), name: 'Empty' }
export const AReplyToAnTaskWithWords: Story = { ...at({ at: 'T012', text: words }), name: 'With words' }
export const RecordingForAnotherTask: Story = { ...at({ at: '', rec: true, recordingFor: scopeDraft('T013') }), name: 'Recording for another task' }
