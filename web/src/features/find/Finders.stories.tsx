// The command palette (⌘K): on the list, on an item, finding items, nothing matches, keys on one row and the pointer on another.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { press, typeInto } from '../../stories/Frames'
import { field, one, palette } from '../../stories/findersFixtures'

export default { title: 'Components/Menus and sheets/Sheets/Command palette' } satisfies Meta
type Story = StoryObj

/** Cmd-K with no item open: the page's commands. */
export const Palette0: Story = { ...one((desk) => palette(desk, null)), name: 'Command palette' }
/** On an item: its commands first. */
export const PaletteOnItem: Story = { ...one((desk) => palette(desk, 1)), name: 'Command palette on an item' }
export const PaletteFinding: Story = { ...one((desk) => palette(desk, null), (r) => typeInto(field(r), 'export')), name: 'Command palette: finding items' }
export const PaletteNothing: Story = { ...one((desk) => palette(desk, null), (r) => typeInto(field(r), 'invoices'), 360), name: 'Command palette: nothing matches' }
/** ↓ twice moves the keys' row; the pointer lights another. */
export const PaletteLooks: Story = { ...one((desk) => palette(desk, null), (r) => press(field(r), 'ArrowDown', 2), 720, { hover: ['[role="dialog"] button:nth-of-type(5)'] }), name: 'Command palette: keys on one, pointer on another' }
