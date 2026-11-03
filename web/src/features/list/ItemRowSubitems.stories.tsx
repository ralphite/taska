// A row with subitems, folded or not, a subitem, and an item that is part of another one shown on its own.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { one } from '../../stories/itemRowFixtures'

export default { title: 'Components/Item list/Item row/Subitems' } satisfies Meta
type Story = StoryObj

export const WithSubitems: Story = { ...one({ foldable: true, f: { kids: { done: 3, all: 8 } } }), name: 'With subitems' }
export const WithSubitemsFolded: Story = { ...one({ foldable: true, folded: true, f: { kids: { done: 3, all: 8 } } }), name: 'With subitems, folded' }
export const Subitem = one({ depth: 1, it: { n: 14, parent: 3, title: 'Keep the filter in the export file name' }, f: { code: 'F014' } })
export const PartOfAnother: Story = { ...one({ it: { n: 14, parent: 3 }, f: { code: 'F014', parentCode: 'F003' } }), name: 'Part of another item (not under it here)' }
