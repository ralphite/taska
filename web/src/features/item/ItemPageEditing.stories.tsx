// An item's page as you change it: editing its words, adding a subitem (the first one too), your reply on its way.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PARENT } from '../../stories/itemPage'
import { at } from '../../stories/itemPageLayoutFixtures'

export default { title: 'Components/Item page/Editing and replying' } satisfies Meta
type Story = StoryObj

export const Editing: Story = { ...at({ f: { editing: true } }), name: 'Editing its title and words' }
export const AddingASubitem: Story = { ...at({ f: { addingSub: true } }), name: 'Adding a subitem' }
/** adding the first subitem of an item with none: the Subitems head with no count, only the field */
export const AddingTheFirstSubitem: Story = { ...at({ others: [PARENT], f: { addingSub: true } }), name: 'Adding the first subitem' }
/** on its way: × cancels it (it is not sent) */
export const YourReplyOnItsWay: Story = { ...at({ t: { outgoing: [{ q: 'q1', text: 'Also keep the sort.', state: 'Sending…', bad: false }] } }), name: 'Your reply on its way' }
