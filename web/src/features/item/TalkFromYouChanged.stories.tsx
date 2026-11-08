// Your message changed afterwards: edited (its history, the earlier version), details added, its input moved.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, at, later, mine, r4, voice } from '../../stories/fromYouFixtures'
import { item } from '../../stories/fixtures'
import { talkOf } from '../../stories/itemPage'
import { one as tip } from '../../stories/tipFixtures'
import { record } from '../../stories/fixtures'

export default { title: 'UI/Item pane/Talk/Message/From you/Changed afterwards' } satisfies Meta
type Story = StoryObj

export const Edited = at([mine({ edited: later(1) })])
export const EditedWithItsHistory: Story = {
  ...at([mine({ edited: later(1) })], { inputs: [r4({ history: [{ text: 'The export should keep the filter.', t: T, mode: 'edit' }] })] }),
  name: 'Edited, with its history',
}
export const EditedTheEarlierVersionAbove: Story = {
  ...at([mine({ text: 'The export should keep the filter.' }), mine({ id: 2, text: 'r4 updated:\nThe export should keep the filter and the sort.', t: later(2) })]),
  name: 'Edited: the earlier version above',
}
export const DetailsAddedLater: Story = {
  ...at([mine({ text: 'The export should keep the filter I set.' }), mine({ id: 2, text: 'The export should keep the filter I set.\n\nAnd the sort.', t: later(2) })]),
  name: 'Details added later',
}
export const ItsInputMovedToAnotherProject: Story = { ...at([mine()], { inputs: [r4({ files: [voice], moved: { to: 'mobile-app', as: 'r4' } })] }), name: 'Moved to another project' }
/** The desktop: the pointer on its voice note shows the words it heard (the page's own tip). */
export const MovedPointerOnItsVoiceNote: Story = {
  ...tip(
    () => talkOf(item({ n: 12, thread: [mine()] }), true, { inputs: [r4({ files: [{ ...voice, voice: record(voice.f, 'The export should keep the filter I set.', 'the export should keep the filter i set') }], moved: { to: 'mobile-app', as: 'r4' } })] }),
    'button[aria-label^="Play"]',
    { width: 720, height: 320, pageTip: true },
  ),
  name: 'Moved, pointer on its voice note',
}
