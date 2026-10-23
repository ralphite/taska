// T512, B515: Top bar and list head > Tabs: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Frame from '../parts/Frame'

const meta: Meta = { title: 'Components/Top bar and list head/Tabs' }
export default meta

export const TabsItems: StoryObj = { ...Frame.TabsItems, name: 'Items' }
export const TabsInputs: StoryObj = { ...Frame.TabsInputs, name: 'Inputs' }
export const TabsArchive: StoryObj = { ...Frame.TabsArchive, name: 'Archive' }
export const TabsRules: StoryObj = { ...Frame.TabsRules, name: 'Rules' }
