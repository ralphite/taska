// T512, B515: Icons and marks > Agent avatar: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Basics from '../parts/Basics'

const meta: Meta = { title: 'Components/Icons and marks/Agent avatar' }
export default meta

export const AgentMarks: StoryObj = { ...Basics.AgentMarks, name: 'Every agent' }
