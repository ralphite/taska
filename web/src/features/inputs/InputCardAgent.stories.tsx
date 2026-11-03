// An input the organizer left for a coding agent: left, handled (taken by an agent, or read with nothing to file), and
// the items an agent changed for it.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { T, input } from '../../stories/fixtures'
import { ONE } from '../../stories/inputFixtures'
import { one } from '../../stories/inputCardFixtures'

export default { title: 'Components/Inputs/Input card/What it became/Left for an agent' } satisfies Meta
type Story = StoryObj

/** The organizer left it for your coding agent (its model said pass). */
export const LeftForYourAgent: Story = { ...one(ONE.left), name: 'Left for an agent' }
/** Left for your agent, and your agent has taken it. */
export const HandledByYourAgent: Story = { ...one(ONE.handled), name: 'Handled by an agent' }
/** Left for your agent, which changed an item for it. */
export const ChangedByAnAgent: Story = { ...one(input({ id: 'r32', t: T, acked: true, touched: [12], text: 'Keep the sort too.', org: { ok: true, msg: 'Left for your coding agent', t: '', keep: true, changed: false, undone: false } })), name: 'Items an agent changed for it' }
