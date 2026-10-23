// T512, B515: Icons and marks > Item status icon: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Basics from '../parts/Basics'

const meta: Meta = { title: 'Components/Icons and marks/Item status icon' }
export default meta

export const States: StoryObj = { ...Basics.States, name: 'Every item status' }
