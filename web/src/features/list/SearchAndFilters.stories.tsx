// The item list searched and filtered: the page's own steps
// mark the words found and say where else they are; the filters set show above the rows.
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ListQuery } from '../../model/route'
import { Frames } from '../../stories/Frames'
import { T } from '../../stories/fixtures'
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
export const NothingFound: Story = { ...at({ q: 'zebra' }), name: 'Nothing found' }
export const Filtered: Story = { ...at({ type: 'bug', pri: 'P0' }), name: 'Filtered: bugs, P0' }
// ---- more states (T639): what a search finds elsewhere, under the rows and with nothing here
const elsewhere = { q: 'export', failed: false, list: [{ project: 'home', ptitle: 'Home', kind: 'item' as const, code: 'T07', title: 'Export the photos to the drive', status: 'open' as const, archived: false, t: T }] }
const withHints = (q: Partial<ListQuery>): Story => ({
  render: () => <Frames phoneWidth={393} deskWidth={460} height={620}>{(layout) => listOf(PROJECT, 'items', q, layout === 'desk', { cross: { ...elsewhere, q: q.q ?? '' } })}</Frames>,
})
export const SearchFoundElsewhereToo: Story = { ...withHints({ q: 'export' }), name: 'Search: found in other projects too' }
export const NothingHereFoundElsewhere: Story = { ...withHints({ q: 'photos' }), name: 'Nothing here, found in another project' }
