// A long input, opened, and one jumped to.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ONE } from '../../stories/inputFixtures'
import { one } from '../../stories/inputCardFixtures'

export default { title: 'UI/Inputs page/Input row/Long, and jumped to' } satisfies Meta
type Story = StoryObj

/** A long one: folded to a few lines, More opens it. */
export const Long: Story = { ...one(ONE.long), name: 'Long' }
export const LongOpened: Story = { ...one(ONE.long, { opened: ['r9'] }), name: 'Long, opened' }
// ---- more states (B636)
export const JumpedToAnInput: Story = { ...one(ONE.made, { lit: ONE.made.id }), name: 'Jumped to an input' }
