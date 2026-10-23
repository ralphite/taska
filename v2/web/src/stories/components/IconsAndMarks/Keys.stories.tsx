// T512, B515: Icons and marks > Keys: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Basics from '../parts/Basics'

const meta: Meta = { title: 'Components/Icons and marks/Keys' }
export default meta

export const Keys: StoryObj = { ...Basics.Keys, name: 'Keyboard keys' }
