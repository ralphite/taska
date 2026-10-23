// T512, B515: Item page > Layout and editing: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Item from '../parts/Item'

const meta: Meta = { title: 'Components/Item page/Layout and editing' }
export default meta

export const Editing: StoryObj = { ...Item.Editing, name: 'Editing' }
export const AddingSubitem: StoryObj = { ...Item.AddingSubitem, name: 'Adding a subitem' }
export const FullWidth: StoryObj = {
  ...Item.FullWidth,
  name: 'Full width',
  parameters: { ...Item.FullWidth.parameters, platform: 'desktop' },
}
export const TwoColumns: StoryObj = {
  ...Item.TwoColumns,
  name: 'Two columns',
  parameters: { ...Item.TwoColumns.parameters, platform: 'desktop' },
}
export const LinePointed: StoryObj = { ...Item.LinePointed, name: 'Line, pointer on it' }
export const GoingThrough: StoryObj = {
  ...Item.GoingThrough,
  name: 'Going through',
  parameters: { ...Item.GoingThrough.parameters, platform: 'desktop' },
}
export const ReplySending: StoryObj = { ...Item.ReplySending, name: 'Your reply on its way' }
