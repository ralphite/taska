// T512, B515: Menus and sheets > Move and pick: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Sheets from '../parts/Sheets'

const meta: Meta = { title: 'Components/Menus and sheets/Move and pick' }
export default meta

export const MoveItem: StoryObj = { ...Sheets.MoveItem, name: 'Move an item' }
export const PickAnItem: StoryObj = { ...Sheets.PickAnItem, name: 'Put an input with an item' }
export const MoveToProject: StoryObj = { ...Sheets.MoveToProject, name: 'Item to another project' }
export const MoveInput: StoryObj = { ...Sheets.MoveInput, name: 'Input to another project' }
export const MoveComment: StoryObj = { ...Sheets.MoveComment, name: 'Move a comment' }
export const SwitchProject: StoryObj = { ...Sheets.SwitchProject, name: 'Switch project' }
