// The phone's Filters sheet (T591: Menus and sheets > Sheets > Filters): the page's own facts (filterFacts) and parts
// with the item list's demo project, bugs of P1 set, newest first.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { filtersSheet } from '../features/list/Filters'
import { filterFacts } from '../features/list/filterFacts'
import { NO_FILTERS } from '../model/route'
import { Frames } from './Frames'
import { menuModel, no, opened, underList } from './menuFixtures'

export default { title: 'Components/Menus and sheets/Sheets' } satisfies Meta
type Story = StoryObj

export const Filters: Story = {
  render: () => (
    <Frames desk={false} height={780} phoneWidth={393}>
      {() => opened(filtersSheet(filterFacts(menuModel(), 'items', { ...NO_FILTERS, type: 'bug', pri: 'P1', sort: 'new' }), { set: no, unset: no, reset: no, saveView: no, close: no }), false, { under: underList(false) })}
    </Frames>
  ),
}
