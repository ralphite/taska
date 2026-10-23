// T512, B515: Document > Editing: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Document from '../parts/Document'

const meta: Meta = { title: 'Components/Document/Editing' }
export default meta

export const Editing: StoryObj = { ...Document.Editing, name: 'Editor' }
