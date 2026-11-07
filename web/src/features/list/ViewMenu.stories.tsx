// One of your views' menu (T591: Menus and sheets > Other menus): the page's own parts, at the pointer on the view's
// tab on the desktop, a sheet on the phone.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Frames } from '../../stories/Frames'
import { AT_POINTER, acts, opened, underList } from '../../stories/menuFixtures'
import { viewMenuSheet } from './ViewMenu'

export default { title: 'UI/List pane/View tabs/View chips/Its menu' } satisfies Meta
type Story = StoryObj

/** Rename makes its tab a field ([View chips › Your own view: shown, being renamed](?path=/story/components-item-list-view-chips--your-own-view-shown-being-renamed)). */
export const ViewMenu: Story = {
  name: 'One of your views',
  render: () => <Frames height={420} deskWidth={900} phoneWidth={393}>{(layout) => opened(viewMenuSheet('Bugs now', acts('View menu', ['rename', 'update', 'remove'], { rename: 'View chips › Your own view: shown, being renamed' })), layout === 'desk', { under: underList(layout === 'desk'), look: layout === 'desk' ? { pop: true, at: AT_POINTER(420, 100) } : {} })}</Frames>,
}
