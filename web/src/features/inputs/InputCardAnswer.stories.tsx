// An input that is your answer to an agent's question, and one you moved to another project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ONE } from '../../stories/inputFixtures'
import { one } from '../../stories/inputCardFixtures'

export default { title: 'Components/Inputs/Input card/What it became/An answer, or moved away' } satisfies Meta
type Story = StoryObj

/** Your answer to T007's question, sent from its card: an input of its own, an answer. */
export const AnAnswer: Story = { ...one(ONE.answer), name: 'An answer to a question' }
export const MovedToAnotherProject: Story = { ...one(ONE.moved), name: 'Moved to another project' }
