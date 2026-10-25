// One input as a row of the phone's Inputs tab draws it, one story for each state it can be in (T591: the groups and
// names Yadong had before the rewrite): the page's own rows (inputRows) and InputCard. Only the phone draws an input
// this way: on the desktop what you said is under New input.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Input } from '../../model/types'
import { Frames } from '../../stories/Frames'
import { ONE, cardOf, type Said } from '../../stories/inputFixtures'

export default { title: 'Components/Inputs/Input card' } satisfies Meta
type Story = StoryObj

const one = (r: Input, name: string, s: Said = { organizer: true }): Story => ({ name, render: () => <Frames desk={false} phoneWidth={393}>{() => cardOf(r, s)}</Frames> })

/** With its screenshot: no agent has read it yet (the organizer is off). */
export const WaitingForYourAgent = one(ONE.waiting, 'Waiting for your agent', {})
export const VoiceNote = one(ONE.voice, 'Voice note', {})
/** Said into the box's mic and sent while the speech model still works out its words. */
export const Transcribing = one(ONE.transcribing, 'Transcribing')
/** The organizer is working on it now. */
export const Organizing = one(ONE.organizing, 'Organizing', { organizer: true, busy: 'r20' })
/** Made into an item: what became of it under your words. */
export const MadeAnItem = one(ONE.made, 'Made an item')
export const AddedToAnItem = one(ONE.added, 'Added to an item')
/** The organizer left it for your coding agent (its model said pass). */
export const LeftForYourAgent = one(ONE.left, 'Left for your agent')
/** Left for your agent, and your agent has taken it. */
export const HandledByYourAgent = one(ONE.handled, 'Handled by your agent')
/** Your agent read it and took it, with no item made. */
export const SeenByYourAgent = one(ONE.seen, 'Seen by your agent')
/** The organizer's commands failed (it named an item the project does not have): Retry. */
export const OrganizerFailed = one(ONE.failed, 'Organizer failed')
/** Filed as a new bug, then Undo on the line after sending: what the organizer did is taken back. */
export const Undone = one(ONE.undone, 'Undone')
/** Changed after sending: as it is now (its earlier words are under ⋯, History). */
export const Edited = one(ONE.edited, 'Edited')
export const MovedToAnotherProject = one(ONE.moved, 'Moved to another project')
/** Your answer to T007's question, sent from its card: an input of its own, an answer. */
export const AnAnswer = one(ONE.answer, 'An answer')
/** A long one: folded to a few lines, More opens it. */
export const Long = one(ONE.long, 'Long')
export const LongOpened = one(ONE.long, 'Long, opened', { organizer: true, opened: ['r9'] })
