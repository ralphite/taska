import type { Meta, StoryObj } from '@storybook/react-vite'
import { item, modelOf } from '../../stories/fixtures'
import { SheetFrames, no } from '../../stories/sheetFixtures'
import { moveParentSheet, pickSheet } from './Pickers'

const meta: Meta = { title: 'Components/Sheets/Pickers' }
export default meta
type Story = StoryObj

const items = [item({ n: 3, title: 'Exports that keep what you see' }), item({ n: 12, parent: 3 }), item({ n: 14, status: 'done', title: 'Sort by priority' }), item({ n: 15, type: 'bug', title: 'Saving drops the last word' })]
const m = modelOf(items)
const code = (n: number) => 'F' + String(n).padStart(3, '0')

/** Put under…: the items it can go under (its parent marked), and No parent; and any item a command needs. */
export const Pick: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <SheetFrames height={520} parts={(l) => moveParentSheet({ it: items[1], items, kids: m.kids, code, desk: l === 'desk' }, no)} />
      <SheetFrames height={520} parts={(l) => pickSheet({ head: 'Put #12 with…', items, skip: [], code, desk: l === 'desk' }, no)} />
    </div>
  ),
}
