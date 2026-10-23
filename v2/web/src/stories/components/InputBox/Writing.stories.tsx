// T512, B515: Input box > Writing: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as InputBox from '../parts/InputBox'

const meta: Meta = { title: 'Components/Input box/Writing' }
export default meta

export const Empty: StoryObj = { ...InputBox.Empty, name: 'Empty' }
export const Words: StoryObj = { ...InputBox.Words, name: 'Words' }
export const ManyLines: StoryObj = { ...InputBox.ManyLines, name: 'Many lines' }
export const ToAnItem: StoryObj = { ...InputBox.ToAnItem, name: 'Reply to an item' }
export const CommentOnAParagraph: StoryObj = { ...InputBox.CommentOnAParagraph, name: 'Comment on a paragraph' }
export const EditingAnInput: StoryObj = { ...InputBox.EditingAnInput, name: 'Editing an input' }
export const AddingToAnInput: StoryObj = { ...InputBox.AddingToAnInput, name: 'Adding to an input' }
