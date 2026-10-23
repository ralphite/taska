// T512, B515: Sidebar: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Frame from '../parts/Frame'

const meta: Meta = { title: 'Components/Sidebar' }
export default meta

export const Sidebar: StoryObj = { ...Frame.Sidebar, name: 'Sidebar and phone drawer' }
/** T522 (r731): every look under the pointer, the keyboard, a press, a drag, side by side. */
export const SidebarLooks: StoryObj = {
  ...Frame.SidebarLooks,
  name: 'Pointer, keys, pressed, dragged: all side by side',
}
export const SidebarSideOpenLooks: StoryObj = { ...Frame.SidebarSideOpenLooks, name: 'Documents open, and the pointer' }
export const RailLooks: StoryObj = { ...Frame.RailLooks, name: 'Folded to icons: pointer, keys, pressed' }
export const DrawerFoot: StoryObj = {
  ...Frame.DrawerFoot,
  name: 'Drawer foot on the phone',
  parameters: { ...Frame.DrawerFoot.parameters, platform: 'phone' },
}
export const RailFolded: StoryObj = {
  ...Frame.RailFolded,
  name: 'Folded to icons',
  parameters: { ...Frame.RailFolded.parameters, platform: 'desktop' },
}
