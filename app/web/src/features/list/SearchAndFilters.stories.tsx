// The item list searched and filtered (T591: the groups and names Yadong had before the rewrite): the page's own steps
// mark the words found and say where else they are; the filters set show above the rows.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ListQuery } from '../../model/route'
import { Frames } from '../../stories/Frames'
import { PROJECT, listOf } from '../../stories/listFixtures'
import { DeskFilters, FilterStrip } from './Filters'
import { NO_FILTERS } from '../../model/route'
import { filtersSet } from '../../model/visible'

export default { title: 'Components/Item list/Search and filters' } satisfies Meta
type Story = StoryObj

const no = () => {}
const at = (q: Partial<ListQuery>): Story => ({
  render: () => (
    <Frames phoneWidth={393} deskWidth={460} height={620}>
      {(layout) => {
        const list = { ...NO_FILTERS, ...q }
        const set = filtersSet('items', list)
        return listOf(PROJECT, 'items', q, layout === 'desk', {
          top: set.length ? (
            layout === 'desk' ? (
              <DeskFilters tab="items" list={list} set={set} open={false} place="" hidden={false} on={{ set: no, unset: no, reset: no, saveView: no, toggle: no }} />
            ) : (
              <FilterStrip set={set} hidden={false} onUnset={no} onReset={no} />
            )
          ) : undefined,
        })
      }}
    </Frames>
  ),
})

export const Search = at({ q: 'export' })
export const NothingFound = at({ q: 'zebra' })
export const Filtered: Story = { ...at({ type: 'bug', pri: 'P0' }), name: 'Filtered: bugs, P0' }
