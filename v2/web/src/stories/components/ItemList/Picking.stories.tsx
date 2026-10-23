// T512, B515: Item list > Picking: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as List from '../parts/List'

const meta: Meta = { title: 'Components/Item list/Picking' }
export default meta

export const OneOpen: StoryObj = { ...List.OneOpen, name: 'One item open' }
export const Picked: StoryObj = { ...List.Picked, name: 'Several picked' }
export const NeedsYouAllShown: StoryObj = { ...List.NeedsYouAllShown, name: 'Needs you: all shown' }
export const SubitemsFolded: StoryObj = { ...List.SubitemsFolded, name: 'Subitems folded' }
export const SubitemsHidden: StoryObj = { ...List.SubitemsHidden, name: 'Subitems in Later or finished' }
export const SubitemsHiddenShown: StoryObj = {
  ...List.SubitemsHiddenShown,
  name: 'Subitems in Later or finished, shown',
}
export const JustActedOn: StoryObj = { ...List.JustActedOn, name: 'A row you just acted on' }
