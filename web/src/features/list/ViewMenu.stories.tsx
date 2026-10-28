// One of your views' menu (T591: Menus and sheets > Other menus): the page's own parts, at the pointer on the view's
// tab on the desktop, a sheet on the phone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { AT_POINTER, no, opened, underList } from '../../stories/menuFixtures'
import { viewMenuSheet } from './ViewMenu'

export default { title: 'Components/Menus and sheets/Other menus' } satisfies Meta
type Story = StoryObj

export const ViewMenu: Story = {
  name: 'One of your views',
  render: () => <Frames height={420} deskWidth={900} phoneWidth={393}>{(layout) => opened(viewMenuSheet('Bugs now', { rename: no, update: no, remove: no }), layout === 'desk', { under: underList(layout === 'desk'), look: layout === 'desk' ? { pop: true, at: AT_POINTER(420, 100) } : {} })}</Frames>,
}
