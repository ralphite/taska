// T512, B515: Item list > Picking and going through: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as List from '../parts/List'

const meta: Meta = { title: 'Components/Item list/Picking and going through' }
export default meta

export const OneOpen: StoryObj = { ...List.OneOpen, name: 'One item open' }
export const Picked: StoryObj = { ...List.Picked, name: 'Several picked' }
export const GoingThrough: StoryObj = { ...List.GoingThrough, name: 'Going through what needs you' }
export const NeedsYouAllShown: StoryObj = { ...List.NeedsYouAllShown, name: 'Needs you: all shown' }
export const SubitemsFolded: StoryObj = { ...List.SubitemsFolded, name: 'Subitems folded' }
export const JustActedOn: StoryObj = { ...List.JustActedOn, name: 'A row you just acted on' }
