// T512, B515: Floating > Tip: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Frame from '../parts/Frame'

const meta: Meta = { title: 'Components/Floating/Tip' }
export default meta

export const PointingTip: StoryObj = { ...Frame.PointingTip, name: "On an agent's mark" }
export const TipRowButton: StoryObj = { ...Frame.TipRowButton, name: "On a row's button" }
export const TipNeedsPill: StoryObj = { ...Frame.TipNeedsPill, name: 'On Approve, in a row that waits on you' }
export const TipRowCount: StoryObj = { ...Frame.TipRowCount, name: "On a row's count of comments" }
export const TipSidebarNeeds: StoryObj = { ...Frame.TipSidebarNeeds, name: "On a project's count in the sidebar" }
export const TipHideSidebar: StoryObj = { ...Frame.TipHideSidebar, name: 'On Hide the sidebar' }
export const TipRailProject: StoryObj = { ...Frame.TipRailProject, name: 'On a project in the rail' }
export const TipRailSettings: StoryObj = { ...Frame.TipRailSettings, name: 'On Settings in the rail' }
export const TipFilters: StoryObj = { ...Frame.TipFilters, name: 'On Filters' }
export const TipStatusChip: StoryObj = { ...Frame.TipStatusChip, name: "On an item's status" }
export const TipAllActions: StoryObj = { ...Frame.TipAllActions, name: "On an item's All actions" }
