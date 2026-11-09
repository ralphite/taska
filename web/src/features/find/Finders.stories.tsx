// Switch project (G P): the list, nothing matches, keys on one row and the pointer on another.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one, switcher, switcherLoading } from '../../stories/findersFixtures'

export default { title: 'UI/Floating/Switch project' } satisfies Meta
type Story = StoryObj

/** G P: the projects in your order, the keys' row on the first that is not this one. */
/** Every project, this one said so; the Needs you mark beside one that needs you (how many in its tip). */
export const Switch: Story = { ...one(switcher, 420), name: 'Every project' }
export const SwitchNothing: Story = { ...one((desk) => switcher(desk, 'invoices'), 300), name: 'Nothing matches' }
/** the keys' row on Home (the first that is not this one), the pointer on todos */
export const SwitchLooks: Story = { ...one(switcher, 420, { hover: ['[role="dialog"] a:nth-of-type(3)'] }), name: 'Keys on one, pointer on another' }
// ---- more states (T639)
export const SwitchLoading: Story = { ...one(switcherLoading, 300), name: 'Loading' }
