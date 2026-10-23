// T512, B515: Sidebar: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Frame from '../parts/Frame'

const meta: Meta = { title: 'Components/Sidebar' }
export default meta

export const Sidebar: StoryObj = { ...Frame.Sidebar, name: 'Sidebar and phone drawer' }
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
