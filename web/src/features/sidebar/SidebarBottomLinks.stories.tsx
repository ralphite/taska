// The sidebar's foot: the links for development (T591: Dev): Storybook and the dashboard, on this computer only
// (the page shows them when it is opened from localhost); the phone drawer's foot and a project in it pressed. The
// page's own sidebar.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { side } from '../../stories/sideFixtures'

export default { title: 'UI/Left sidebar/Bottom links' } satisfies Meta
type Story = StoryObj

export const DevLinks: Story = { name: 'The sidebar with its dev links', render: () => <Frames phone={false} deskWidth={240} height={760}>{() => side(false)}</Frames> }
/** The drawer's foot on the phone: Undo of what you did last (a phone has no Z), the links. */
export const DrawerFoot: Story = { name: 'Phone: Drawer foot', render: () => <Frames desk={false} phoneWidth={320} height={760}>{() => side(true, { undo: 'T009 approved' })}</Frames> }
// ---- more states (T639)
/** a project in the phone's drawer pressed (a finger on it) */
export const DrawerProjectPressed: Story = {
  name: 'Phone drawer: a project pressed',
  render: () => <Frames desk={false} phoneWidth={320} height={560}>{() => side(true, { look: { slug: 'home', as: 'pressed' } })}</Frames>,
}
