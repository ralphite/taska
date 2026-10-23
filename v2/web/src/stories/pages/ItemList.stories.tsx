// T521: Pages > Item list: the project's page at each view of its list, searched and filtered
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SHOP, pageParams, screen } from './screens'

const meta: Meta = { title: 'Pages/Item list', parameters: pageParams() }
export default meta

export const Active: StoryObj = { ...screen(SHOP), name: 'Active' }
export const NeedsYou: StoryObj = { ...screen(SHOP + '?status=wait'), name: 'Needs you' }
export const All: StoryObj = { ...screen(SHOP + '?status=every'), name: 'All' }
export const Queue: StoryObj = { ...screen(SHOP + '?status=queued'), name: 'Queue' }
export const Later: StoryObj = { ...screen(SHOP + '?status=later'), name: 'Later' }
export const Finished: StoryObj = { ...screen(SHOP + '?status=closed'), name: 'Finished' }
export const Archive: StoryObj = { ...screen(SHOP + 'archive'), name: 'Archive' }
export const Rules: StoryObj = { ...screen(SHOP + 'rules'), name: 'Rules' }
export const Search: StoryObj = { ...screen(SHOP + '?q=%E5%AF%BC%E5%87%BA'), name: 'Search' }
export const FilteredBugs: StoryObj = { ...screen(SHOP + '?type=bug'), name: 'Filtered: bugs' }
