// One input as a row of the phone's Inputs tab draws it, one story for each state it can be in (T591: the groups and
// names Yadong had before the rewrite): the page's own rows (inputRows) and InputCard. Only the phone draws an input
// this way: on the desktop what you said is under New input.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Input } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { ONE, cardOf, type Said } from '../../stories/inputFixtures'

export default { title: 'Components/Inputs/Input card' } satisfies Meta
type Story = StoryObj

const one = (r: Input, s: Said = { organizer: true }): Story => ({ render: () => <Frames desk={false} phoneWidth={393}>{() => cardOf(r, s)}</Frames> })

/** With its screenshot: no agent has read it yet (the organizer is off). */
export const WaitingForYourAgent: Story = { ...one(ONE.waiting, {}), name: 'Waiting for your agent' }
export const VoiceNote: Story = { ...one(ONE.voice, {}), name: 'Voice note' }
/** Said into the box's mic and sent while the speech model still works out its words. */
export const Transcribing: Story = { ...one(ONE.transcribing), name: 'Transcribing' }
/** The organizer is working on it now. */
export const Organizing: Story = { ...one(ONE.organizing, { organizer: true, busy: 'r20' }), name: 'Organizing' }
/** Made into an item: what became of it under your words. */
export const MadeAnItem: Story = { ...one(ONE.made), name: 'Made an item' }
export const AddedToAnItem: Story = { ...one(ONE.added), name: 'Added to an item' }
/** The organizer left it for your coding agent (its model said pass). */
export const LeftForYourAgent: Story = { ...one(ONE.left), name: 'Left for your agent' }
/** Left for your agent, and your agent has taken it. */
export const HandledByYourAgent: Story = { ...one(ONE.handled), name: 'Handled by your agent' }
/** Your agent read it and took it, with no item made. */
export const SeenByYourAgent: Story = { ...one(ONE.seen), name: 'Seen by your agent' }
/** The organizer's commands failed (it named an item the project does not have): Retry. */
export const OrganizerFailed: Story = { ...one(ONE.failed), name: 'Organizer failed' }
/** Filed as a new bug, then Undo on the line after sending: what the organizer did is taken back. */
export const Undone: Story = { ...one(ONE.undone), name: 'Undone' }
/** Changed after sending: as it is now (its earlier words are under ⋯, History). */
export const Edited: Story = { ...one(ONE.edited), name: 'Edited' }
export const MovedToAnotherProject: Story = { ...one(ONE.moved), name: 'Moved to another project' }
/** Your answer to T007's question, sent from its card: an input of its own, an answer. */
export const AnAnswer: Story = { ...one(ONE.answer), name: 'An answer' }
/** A long one: folded to a few lines, More opens it. */
export const Long: Story = { ...one(ONE.long), name: 'Long' }
export const LongOpened: Story = { ...one(ONE.long, { organizer: true, opened: ['r9'] }), name: 'Long, opened' }
