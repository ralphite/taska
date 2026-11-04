// The phone's head over the list (T591: Top bar and list head > List head): the menu with the project's name, the
// agent, Search; the list's words while they are searched. The desktop has no head over the list (its search is the
// dialog, F479). From the page's own headFacts with the item list's demo project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frames } from '../stories/Frames'
import { headOf } from '../stories/headFixtures'

export default { title: 'Components/Around the page/Top bar and list head/List head' } satisfies Meta
type Story = StoryObj

/** The menu with the project's name (the Needs you mark when another project needs you), the agent, Search. */
export const ListHead: Story = { name: 'On the phone', render: () => <Frames desk={false} phoneWidth={393} height={200}>{() => headOf(false, { otherNeeds: true })}</Frames> }
/** Words searched in the list (a link with them): each tab says how many it matches, Clear. */
export const ListHeadSearching: Story = { name: 'Searching', render: () => <Frames desk={false} phoneWidth={393} height={200}>{() => headOf(false, { list: { q: 'export' }, searching: true })}</Frames> }
// ---- more states (T639)
/** the phone's head: its menu (the project's name) and Search pressed */
export const PhonePressed: Story = {
  name: 'On the phone: menu and Search pressed',
  render: () => <Frames desk={false} phoneWidth={393} height={200}>{() => <After run={(root) => root.querySelectorAll('header button').forEach((b) => b.setAttribute('data-pressed', ''))}>{headOf(false)}</After>}</Frames>,
}
/** the phone's search just opened, nothing typed yet: the field and Cancel */
export const PhoneSearchOpen: Story = { name: 'On the phone: search open, nothing typed', render: () => <Frames desk={false} phoneWidth={393} height={200}>{() => headOf(false, { searching: true })}</Frames> }
