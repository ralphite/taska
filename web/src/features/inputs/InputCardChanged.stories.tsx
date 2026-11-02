// An input the organizer failed on, undone, edited, or with a draft.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ONE } from '../../stories/inputFixtures'
import { one } from '../../stories/inputCardFixtures'

export default { title: 'Components/Inputs/Input card/Failed, undone, edited' } satisfies Meta
type Story = StoryObj

/** The organizer's commands failed (it named an item the project does not have): Retry. */
export const OrganizerFailed: Story = { ...one(ONE.failed), name: 'Organizer failed' }
/** Filed as a new bug, then Undo on the line after sending: what the organizer did is taken back. */
export const Undone: Story = { ...one(ONE.undone), name: 'Undone' }
/** Changed after sending: as it is now (its earlier words are under ⋯, History). */
export const Edited: Story = { ...one(ONE.edited), name: 'Edited' }
export const WithADraft: Story = { ...one(ONE.waiting, { editDrafts: [ONE.waiting.id] }), name: 'With a draft' }
