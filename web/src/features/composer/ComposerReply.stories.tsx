// The box replying on an item, with words, and recording for another item.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { scopeDraft } from '../../model/draftTarget'
import { at, words } from '../../stories/composerFixtures'

export default { title: 'Components/Input box/What it writes to/A reply to an item' } satisfies Meta
type Story = StoryObj

export const AReplyToAnItem: Story = { ...at({ at: 'F012' }), name: 'A reply to an item' }
export const AReplyToAnItemWithWords: Story = { ...at({ at: 'F012', text: words }), name: 'A reply to an item, with words' }
export const RecordingForAnotherItem: Story = { ...at({ at: '', rec: true, recordingFor: scopeDraft('F013') }), name: 'Recording for another item' }
