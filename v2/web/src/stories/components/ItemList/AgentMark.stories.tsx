// T512, B515: Item list > Agent mark: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as List from '../parts/List'

const meta: Meta = { title: 'Components/Item list/Agent mark' }
export default meta

export const AgentMark: StoryObj = { ...List.AgentMark, name: 'At work and quiet' }
