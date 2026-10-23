// T512, B515: Top bar and list head > Tabs: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Frame from '../parts/Frame'

const meta: Meta = { title: 'Components/Top bar and list head/Tabs' }
export default meta

export const TabsItems: StoryObj = {
  ...Frame.TabsItems,
  name: 'Items',
  parameters: { ...Frame.TabsItems.parameters, platform: 'phone' },
}
export const TabsInputs: StoryObj = {
  ...Frame.TabsInputs,
  name: 'Inputs',
  parameters: { ...Frame.TabsInputs.parameters, platform: 'phone' },
}
export const TabsArchive: StoryObj = {
  ...Frame.TabsArchive,
  name: 'Archive',
  parameters: { ...Frame.TabsArchive.parameters, platform: 'phone' },
}
export const TabsRules: StoryObj = {
  ...Frame.TabsRules,
  name: 'Rules',
  parameters: { ...Frame.TabsRules.parameters, platform: 'phone' },
}
/** T522 (r731): a tab or Filters pressed (the phone has no pointer). */
export const TabsLooks: StoryObj = { ...Frame.TabsLooks, name: 'Pressed: all side by side' }
