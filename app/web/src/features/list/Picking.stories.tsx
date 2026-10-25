// The item list as you work in it (T591: the groups and names Yadong had before the rewrite): an item open, rows
// picked, subitems folded or hidden, a row held still after you acted on it. A demo project's list drawn by the page's
// own steps (../../stories/listFixtures).
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ListQuery } from '../../model/route'
import { Frames } from '../../stories/Frames'
import { PROJECT, listOf, type Holding } from '../../stories/listFixtures'
import { SelBar } from './SelBar'

export default { title: 'Components/Item list/Picking' } satisfies Meta
type Story = StoryObj

const at = (q: Partial<ListQuery>, h: (desk: boolean) => Holding, items = PROJECT): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={460} height={700}>{(layout) => listOf(items, 'items', q, layout === 'desk', h(layout === 'desk'))}</Frames>,
})
const active = { status: 'all' }

export const OneOpen: Story = { ...at(active, () => ({ open: 5 })), name: 'One item open' }
export const SeveralPicked: Story = {
  ...at(active, (desk) => ({ selected: [5, 6, 2], top: desk ? <SelBar n={3} on={{ set() {}, clear() {} }} /> : undefined })),
  name: 'Several picked',
}
export const SubitemsFolded = at(active, () => ({ folded: [1] }))
export const SubitemsInLaterOrFinished: Story = { ...at(active, () => ({})), name: 'Subitems in Later or finished' }
export const SubitemsInLaterOrFinishedShown: Story = { ...at(active, () => ({ subMore: [1] })), name: 'Subitems in Later or finished, shown' }
// F003 approved from the Needs you view: its row stays where it was, one quiet line saying so, until the list moves on
const approved = PROJECT.map((it) => (it.n === 3 ? { ...it, status: 'open' as const } : it))
export const ARowYouJustActedOn: Story = { ...at({ status: 'wait' }, () => ({ held: { before: PROJECT, said: { 3: 'Approved' } } }), approved), name: 'A row you just acted on' }
