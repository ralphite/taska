// T512, B515: Item list > Views: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as List from '../parts/List'

const meta: Meta = { title: 'Components/Item list/Views' }
export default meta

export const Active: StoryObj = { ...List.Active, name: 'Active' }
export const NeedsYou: StoryObj = { ...List.NeedsYou, name: 'Needs you' }
export const All: StoryObj = { ...List.All, name: 'All' }
export const Queue: StoryObj = { ...List.Queue, name: 'Queue' }
export const Later: StoryObj = { ...List.Later, name: 'Later' }
export const Finished: StoryObj = { ...List.Finished, name: 'Finished' }
export const Archive: StoryObj = { ...List.Archive, name: 'Archive' }
export const Rules: StoryObj = { ...List.Rules, name: 'Rules' }
export const OwnViews: StoryObj = { ...List.OwnViews, name: 'Your own views' }
export const EmptyProject: StoryObj = { ...List.EmptyProject, name: 'Empty project' }
export const SmallProject: StoryObj = { ...List.SmallProject, name: 'Small project' }
