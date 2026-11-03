// What an input became: an item, words added to one, an answer, left for an agent, seen or handled by one, moved to another project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, input } from '../../stories/fixtures'
import { ONE } from '../../stories/inputFixtures'
import { one } from '../../stories/inputCardFixtures'

export default { title: 'Components/Inputs/Input card/What it became' } satisfies Meta
type Story = StoryObj

/** Made into an item: what became of it under your words. */
export const MadeAnItem: Story = { ...one(ONE.made), name: 'Made an item' }
export const AddedToAnItem: Story = { ...one(ONE.added), name: 'Added to an item' }
/** Your answer to T007's question, sent from its card: an input of its own, an answer. */
export const AnAnswer: Story = { ...one(ONE.answer), name: 'An answer' }
/** The organizer left it for your coding agent (its model said pass). */
export const LeftForYourAgent: Story = { ...one(ONE.left), name: 'Left for agent' }
/** Your agent read it and took it, with no item made. */
export const SeenByYourAgent: Story = { ...one(ONE.seen), name: 'Seen by agent' }
/** Left for your agent, and your agent has taken it. */
export const HandledByYourAgent: Story = { ...one(ONE.handled), name: 'Handled by agent' }
export const MovedToAnotherProject: Story = { ...one(ONE.moved), name: 'Moved to another project' }
// ---- more states (T639)
const note = (msg: string, f = {}) => ({ ok: true, msg, t: '', keep: false, changed: true, undone: false, ...f })
export const NoteBesideItems: Story = { ...one(input({ id: 'r30', t: T, acked: true, touched: [14], text: 'The coupon box hides behind the keyboard; and should the sort stay?', org: note('Created B014 · asked about the sort') })), name: "The organizer's note beside the items" }
export const NoteNoItems: Story = { ...one(input({ id: 'r31', t: T, acked: true, text: 'Thanks, that looks right.', org: note('Nothing to file: a thank-you', { changed: false }) })), name: "The organizer's note, no item changed" }
export const ChangedByAnAgent: Story = { ...one(input({ id: 'r32', t: T, acked: true, touched: [12], text: 'Keep the sort too.' })), name: 'Items an agent changed (no organizer note)' }
export const SeveralItems: Story = { ...one(input({ id: 'r33', t: T, acked: true, touched: [12, 14, 7], text: 'Three things: the filter, the coupon box, and which formats.', org: note('Created B014; added to F012 and T007') })), name: 'Made several items' }
