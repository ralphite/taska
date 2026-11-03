// Switch project (G P): the list, nothing matches, keys on one row and the pointer on another.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { press, typeInto } from '../../stories/Frames'
import { field, one, switcher, switcherLoading } from '../../stories/findersFixtures'

export default { title: 'Components/Menus and sheets/Sheets/Switch project' } satisfies Meta
type Story = StoryObj

/** G P: the projects in your order, the keys' row on the first that is not this one. */
export const Switch: Story = { ...one(switcher, undefined, 420), name: 'Switch project' }
export const SwitchNothing: Story = { ...one(switcher, (r) => typeInto(field(r), 'invoices'), 300), name: 'Switch project: nothing matches' }
export const SwitchLooks: Story = { ...one(switcher, (r) => press(field(r), 'ArrowDown'), 420, { hover: ['[role="dialog"] a:nth-of-type(4)'] }), name: 'Switch project: keys on one, pointer on another' }
// ---- more states (T639)
export const SwitchLoading: Story = { ...one(switcherLoading, undefined, 300), name: 'Switch project: loading' }
