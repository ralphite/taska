// Switch project (G P): the list, nothing matches, keys on one row and the pointer on another.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { typeInto } from '../../stories/Frames'
import { field, one, switcher, switcherLoading } from '../../stories/findersFixtures'

export default { title: 'Components/Around the page/Menus and sheets/Sheets/Switch project' } satisfies Meta
type Story = StoryObj

/** G P: the projects in your order, the keys' row on the first that is not this one. */
export const Switch: Story = { ...one(switcher, undefined, 420), name: 'Every project' }
export const SwitchNothing: Story = { ...one(switcher, (r) => typeInto(field(r), 'invoices'), 300), name: 'Nothing matches' }
/** the keys' row on Home (the first that is not this one), the pointer on todos */
export const SwitchLooks: Story = { ...one(switcher, undefined, 420, { hover: ['[role="dialog"] a:nth-of-type(3)'] }), name: 'Keys on one, pointer on another' }
// ---- more states (T639)
export const SwitchLoading: Story = { ...one(switcherLoading, undefined, 300), name: 'Loading' }
