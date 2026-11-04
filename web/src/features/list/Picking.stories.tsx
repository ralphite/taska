// The item list as you work in it: an item open, rows
// picked, subitems folded or hidden, a row held still after you acted on it. A demo project's list drawn by the page's
// own steps (../../stories/listFixtures).
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ListQuery } from '../../model/route'
import { Frames } from '../../stories/Frames'
import { PROJECT, listOf, type Holding } from '../../stories/listFixtures'

export default { title: 'Components/Item list/Picked, folded, just acted on' } satisfies Meta
type Story = StoryObj

const at = (q: Partial<ListQuery>, h: (desk: boolean) => Holding, items = PROJECT): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={460} height={700}>{(layout) => listOf(items, 'items', q, layout === 'desk', h(layout === 'desk'))}</Frames>,
})
const active = { status: 'all' }

export const OneOpen: Story = { ...at(active, () => ({ open: 5 })), name: 'One item open' }
/** The desktop (⌘ or ⇧ click; the phone picks none). */
export const SeveralPicked: Story = {
  render: () => <Frames phone={false} deskWidth={460} height={700}>{() => listOf(PROJECT, 'items', active, true, { selected: [5, 6, 2] })}</Frames>,
  name: 'Several picked',
}
export const SubitemsFolded: Story = { ...at(active, () => ({ folded: [1] })), name: 'Subitems folded' }
export const SubitemsInLater: Story = { ...at(active, () => ({})), name: 'Subitems in Later' }
export const SubitemsInLaterShown: Story = { ...at(active, () => ({ subMore: [1] })), name: 'Subitems in Later, shown' }
// F003 approved from the Needs you view: its row stays where it was, one quiet line saying so, until the list moves on
const approved = PROJECT.map((it) => (it.n === 3 ? { ...it, status: 'open' as const } : it))
export const ARowYouJustActedOn: Story = { ...at({ status: 'wait' }, () => ({ held: { before: PROJECT, said: { 3: 'Approved' } } }), approved), name: 'A row you just acted on' }
// ---- more states (B636)
export const DraggedOffEveryRow: Story = { ...at(active, () => ({ dragging: { out: true } })), name: 'Dragged off every row' }
