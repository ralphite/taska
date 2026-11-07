// The phone's head over the list (T591: Top bar and list head > List head): the menu with the project's name, the
// agent, Search (it opens the search page). The desktop has no head over the list (its search is the
// dialog, F479). From the page's own headFacts with the item list's demo project.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { After, Frames } from '../stories/Frames'
import { headOf } from '../stories/headFixtures'

export default { title: 'UI/List pane/Top bar/List head' } satisfies Meta
type Story = StoryObj

/** The menu with the project's name (the Needs you mark when another project needs you), the agent, Search. */
export const ListHead: Story = { name: 'Phone', render: () => <Frames desk={false} phoneWidth={393} height={200}>{() => headOf(false, { otherNeeds: true })}</Frames> }
// ---- more states (T639)
/** the phone's head: its menu (the project's name) and Search pressed */
export const PhonePressed: Story = {
  name: 'Phone: menu and Search pressed',
  render: () => <Frames desk={false} phoneWidth={393} height={200}>{() => <After run={(root) => root.querySelectorAll('header button').forEach((b) => b.setAttribute('data-pressed', ''))}>{headOf(false)}</After>}</Frames>,
}
