// The filters (T591: Top bar and list head > Filters): what is set as chips that take it off, on the phone a row under
// the tabs, on the desktop a row under the search that opens to every control, from the page's own filtersSet with
// the item list's demo project. The phone's sheet of controls is in Menus and sheets > Sheets.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { headOf } from '../../stories/headFixtures'

export default { title: 'Components/Top bar and list head/Filters' } satisfies Meta
type Story = StoryObj

const BUGS = { type: 'bug', pri: 'P0', sort: 'new' }

export const PhoneStrip: Story = { name: 'Strip on the phone', render: () => <Frames desk={false} phoneWidth={393} height={200}>{() => headOf(false, { list: BUGS })}</Frames> }
export const DeskPanel: Story = { name: 'Panel on the desktop', render: () => <Frames phone={false} deskWidth={1100} height={460}>{() => headOf(true, { list: BUGS, filtersOpen: true })}</Frames> }
/** Set and folded: the chips, Clear, the dot on the filters button. */
export const FilterChipsAndDot: Story = { name: 'Chips', render: () => <Frames deskWidth={1100} phoneWidth={393} height={220}>{(layout) => headOf(layout === 'desk', { list: BUGS })}</Frames> }
