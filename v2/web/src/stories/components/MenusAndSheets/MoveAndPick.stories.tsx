// T512, B515: Menus and sheets > Move and pick: putting an item under another, an item or what you said in another
// project, what you said with an item, a comment elsewhere in its document; the parts module opens each the page's way
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Sheets from '../parts/Sheets'

const meta: Meta = { title: 'Components/Menus and sheets/Move and pick' }
export default meta

export const MoveItem: StoryObj = { ...Sheets.MoveItem, name: 'Put under' }
export const MoveItemNothingMatches: StoryObj = { ...Sheets.MoveItemNothingMatches, name: 'Put under: nothing matches' }
export const MoveToProject: StoryObj = { ...Sheets.MoveToProject, name: 'Item to another project' }
export const PickAnItem: StoryObj = { ...Sheets.PickAnItem, name: 'What you said, with another item' }
export const MoveInput: StoryObj = { ...Sheets.MoveInput, name: 'What you said, to another project' }
export const MoveComment: StoryObj = { ...Sheets.MoveComment, name: 'Move a comment' }
