// What an input became: an item, words added to one, an answer, left for an agent, seen or handled by one, moved to another project.
import type { Meta, StoryObj } from '@storybook/react-vite'
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
