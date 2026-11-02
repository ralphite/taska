// Your message changed afterwards: edited (its history, the earlier version), details added, its input moved.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, at, later, mine, r4, voice } from '../../stories/fromYouFixtures'

export default { title: 'Components/Conversation/Message/From you/Changed afterwards' } satisfies Meta
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
export const ItsInputMovedToAnotherProject = at([mine()], { inputs: [r4({ files: [voice], moved: { to: 'home', as: 'r40' } })] })
export const MovedPointerOnItsVoiceNote: Story = {
  ...at([mine()], { inputs: [r4({ files: [voice], moved: { to: 'home', as: 'r40' } })] }),
  name: 'Moved, pointer on its voice note',
  parameters: { pseudo: { hover: ['[data-voice], .group'] } },
}
