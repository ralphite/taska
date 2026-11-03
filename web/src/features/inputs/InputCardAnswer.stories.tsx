// An input that is your answer to an agent's question, one you moved to another project, and a recording you
// cancelled, kept to send later (B627).
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ONE } from '../../stories/inputFixtures'
import { one } from '../../stories/inputCardFixtures'

export default { title: 'Components/Inputs/Input card/What it became/An answer, or moved away' } satisfies Meta
type Story = StoryObj

/** Your answer to T007's question, sent from its card: an input of its own, an answer. */
export const AnAnswer: Story = { ...one(ONE.answer), name: 'An answer to a question' }
export const MovedToAnotherProject: Story = { ...one(ONE.moved), name: 'Moved to another project' }
/** A recording cancelled with Esc: kept, its voice note playable, sent to no one until Send. */
export const ACancelledRecording: Story = { ...one(ONE.cancelled), name: 'A cancelled recording: Send' }
