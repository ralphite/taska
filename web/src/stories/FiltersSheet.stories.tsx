// The phone's Filters sheet (T591: Menus and sheets > Sheets > Filters): the page's own facts (filterFacts) and parts
// with the item list's demo project, bugs of P1 set, newest first.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { filtersSheet } from '../features/list/Filters'
import { filterFacts } from '../features/list/filterFacts'
import { NO_FILTERS } from '../model/route'
import { Frames } from './Frames'
import { acts, menuModel, opened, underList } from './menuFixtures'

export default { title: 'Components/Around the page/Menus and sheets/Sheets/Filters on the phone' } satisfies Meta
type Story = StoryObj

const filtersOn = acts('Filters', ['set', 'unset', 'reset', 'saveView', 'close'])

export const Filters: Story = {
  name: 'Bugs of P1, newest first',
  render: () => (
    <Frames desk={false} height={780} phoneWidth={393}>
      {() => opened(filtersSheet(filterFacts(menuModel(), 'items', { ...NO_FILTERS, type: 'bug', pri: 'P1', sort: 'new' }), filtersOn), false, { under: underList(false) })}
    </Frames>
  ),
}
// ---- more states (T639)
const sheetOn = (tab: 'items' | 'archive' | 'rules', q = {}): Story => ({
  render: () => <Frames desk={false} height={780} phoneWidth={393}>{() => opened(filtersSheet(filterFacts(menuModel(), tab, { ...NO_FILTERS, ...q }), filtersOn), false, { under: underList(false) })}</Frames>,
})
/** on Rules: no Type or Priority, the rules' own statuses, "Show N rules" */
export const OnRules: Story = { ...sheetOn('rules'), name: 'On Rules' }
/** on Archive: When, and the archive's statuses */
export const OnArchive: Story = { ...sheetOn('archive'), name: 'On Archive' }
/** nothing set: no Clear all, Show says how many items */
export const NothingSet: Story = { ...sheetOn('items'), name: 'Nothing set' }
