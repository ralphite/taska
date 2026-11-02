// The box replying on an item, with words, and recording for another item.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { scopeDraft } from '../../model/draftTarget'
import { at, words } from '../../stories/composerFixtures'

export default { title: 'Components/Input box/What it writes to/A reply to an item' } satisfies Meta
type Story = StoryObj

export const AReplyToAnItem = at({ at: 'F012' })
export const AReplyToAnItemWithWords: Story = { ...at({ at: 'F012', text: words }), name: 'A reply to an item, with words' }
export const RecordingForAnotherItem = at({ at: '', rec: true, recordingFor: scopeDraft('F013') })
