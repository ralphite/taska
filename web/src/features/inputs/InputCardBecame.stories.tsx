// What the organizer made of an input: an item, words added to one, several items, its note beside them or alone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, input } from '../../stories/fixtures'
import { ONE } from '../../stories/inputFixtures'
import { one } from '../../stories/inputCardFixtures'

export default { title: 'Components/Inputs/Input card/What it became/Filed by the organizer' } satisfies Meta
type Story = StoryObj

const note = (msg: string, f = {}) => ({ ok: true, msg, t: '', keep: false, changed: true, undone: false, ...f })
/** Made into an item: what became of it under your words. */
export const MadeAnItem: Story = { ...one(ONE.made), name: 'Made an item' }
export const AddedToAnItem: Story = { ...one(ONE.added), name: 'Added to an item' }
export const SeveralItems: Story = { ...one(input({ id: 'r33', t: T, acked: true, touched: [12, 14, 7], text: 'Three things: the filter, the coupon box, and which formats.', org: note('Created B014; added to F012 and T007') })), name: 'Made several items' }
export const NoteBesideItems: Story = { ...one(input({ id: 'r30', t: T, acked: true, touched: [14], text: 'The coupon box hides behind the keyboard; and should the sort stay?', org: note('Created B014 · asked about the sort') })), name: "The organizer's note beside the items" }
export const NoteNoItems: Story = { ...one(input({ id: 'r31', t: T, acked: true, text: 'Thanks, that looks right.', org: note('Nothing to file: a thank-you', { changed: false }) })), name: "The organizer's note, no item changed" }
