// T512, B515: Document > Choices: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Document from '../parts/Document'

const meta: Meta = { title: 'Components/Document/Choices' }
export default meta

export const Checklist: StoryObj = { ...Document.Checklist, name: 'Checklist' }
export const Ticked: StoryObj = { ...Document.Ticked, name: 'Ticked' }
