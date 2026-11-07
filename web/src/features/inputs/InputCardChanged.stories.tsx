// An input the organizer couldn't organize, its organizing undone, edited, or with a draft.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ONE } from '../../stories/inputFixtures'
import { one } from '../../stories/inputCardFixtures'

export default { title: 'UI/Inputs page/Input row/Failed, undone, edited' } satisfies Meta
type Story = StoryObj

/** The organizer's commands failed (it named an item the project does not have): why, and Try again. */
export const OrganizerFailed: Story = { ...one(ONE.failed), name: "Couldn't organize: Try again" }
/** The organizer's key refused: where to fix it, no Try again (it would fail the same way). */
export const OrganizerKeyRefused: Story = { ...one(ONE.keyRefused), name: "Couldn't organize: its key not accepted" }
/** Filed as a new bug, then Undo on the line after sending: what the organizer did is taken back. */
export const Undone: Story = { ...one(ONE.undone), name: 'Organizing undone: Organize again' }
/** Changed after sending: as it is now (its earlier words are under ⋯, History). */
export const Edited: Story = { ...one(ONE.edited), name: 'Edited' }
export const WithADraft: Story = { ...one(ONE.waiting, { editDrafts: [ONE.waiting.id] }), name: 'With a draft' }
