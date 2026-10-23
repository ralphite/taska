// T512, B515: Item page > Layout and editing: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Item from '../parts/Item'

const meta: Meta = { title: 'Components/Item page/Layout and editing' }
export default meta

export const Editing: StoryObj = { ...Item.Editing, name: 'Editing' }
export const FullWidth: StoryObj = { ...Item.FullWidth, name: 'Full width' }
export const TwoColumns: StoryObj = { ...Item.TwoColumns, name: 'Two columns' }
export const GoingThrough: StoryObj = { ...Item.GoingThrough, name: 'Going through' }
export const ReplySending: StoryObj = { ...Item.ReplySending, name: 'Your reply on its way' }
export const NothingPicked: StoryObj = { ...Item.NothingPicked, name: 'Nothing picked' }
