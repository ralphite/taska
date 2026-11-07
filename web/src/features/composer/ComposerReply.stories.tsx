// The box replying on an item, with words, and recording for another item.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { scopeDraft } from '../../model/draftTarget'
import { at, words } from '../../stories/composerFixtures'

export default { title: 'UI/Input box/What it writes to/A reply to an item' } satisfies Meta
type Story = StoryObj

export const AReplyToAnItem: Story = { ...at({ at: 'F012' }), name: 'Empty' }
export const AReplyToAnItemWithWords: Story = { ...at({ at: 'F012', text: words }), name: 'With words' }
export const RecordingForAnotherItem: Story = { ...at({ at: '', rec: true, recordingFor: scopeDraft('F013') }), name: 'Recording for another item' }
