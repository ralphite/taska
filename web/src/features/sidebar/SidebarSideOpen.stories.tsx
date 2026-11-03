// Documents, Activity or Deleted open beside the items.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { side } from '../../stories/sideFixtures'

export default { title: 'Components/Around the page/Sidebar/A list open beside it' } satisfies Meta
type Story = StoryObj

/** Documents open beside the pane (lit), and the pointer on Activity. */
export const SidebarSideOpenLooks: Story = {
  name: 'Documents open, and the pointer',
  parameters: { pseudo: { hover: ['nav a[href$="/log"]'] } },
  render: () => <Frames phone={false} deskWidth={240} height={760}>{() => side(false, { side: 'docs' })}</Frames>,
}
export const ActivityOpen: Story = {
  name: 'Activity open',
  render: () => <Frames phone={false} deskWidth={240} height={760}>{() => side(false, { side: 'log' })}</Frames>,
}
export const DeletedOpen: Story = {
  name: 'Deleted open',
  render: () => <Frames phone={false} deskWidth={240} height={760}>{() => side(false, { side: 'deleted' })}</Frames>,
}
