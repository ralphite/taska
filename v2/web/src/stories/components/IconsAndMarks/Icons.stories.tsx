// T512, B515: Icons and marks > Icons: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Basics from '../parts/Basics'

const meta: Meta = { title: 'Components/Icons and marks/Icons' }
export default meta

export const Icons: StoryObj = { ...Basics.Icons, name: 'Every icon and where it is used' }
