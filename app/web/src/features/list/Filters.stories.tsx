import type { Meta, StoryObj } from '@storybook/react-vite'
import { NO_FILTERS } from '../../model/route'
import { Frames } from '../../stories/Frames'
import { SheetFrames, no } from '../../stories/sheetFixtures'
import { DeskFilters, FilterStrip, filtersSheet } from './Filters'

const meta: Meta = { title: 'Components/Top bar and list head/Filters' }
export default meta
type Story = StoryObj

const on = { set: no, unset: no, reset: no, saveView: no }
const list = { ...NO_FILTERS, type: 'bug', pri: 'P1', sort: 'new' }

/** The phone's sheet on Items (with Save as a view) and on Rules. */
export const PhoneSheet: Story = {
  render: () => <SheetFrames desk={false} height={760} parts={() => filtersSheet({ tab: 'items', list, filtered: true, shown: 12, open: 9 }, { ...on, close: no })} />,
}

/** The phone's row of the filters set, under the tabs, with Clear. */
export const PhoneStrip: Story = {
  render: () => (
    <Frames desk={false} phoneWidth={393}>
      {() => <FilterStrip set={[['type', 'Bug'], ['pri', 'P1'], ['sort', 'Newest']]} hidden={false} onUnset={no} onReset={no} />}
    </Frames>
  ),
}

/** The desktop's row under the search: what is set, then opened to the controls. */
export const DeskRow: Story = {
  render: () => (
    <Frames phone={false} deskWidth={420}>
      {() => (
        <div className="flex flex-col gap-6">
          <DeskFilters tab="items" list={list} set={[['type', 'Bug'], ['pri', 'P1'], ['sort', 'Newest']]} open={false} place="" hidden={false} on={{ ...on, toggle: no }} />
          <DeskFilters tab="archive" list={{ ...list, when: 'later', status: 'done' }} set={[['when', 'Later'], ['status', 'Done']]} open place="" hidden={false} on={{ ...on, toggle: no }} />
        </div>
      )}
    </Frames>
  ),
}
