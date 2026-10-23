// T512, B515: Home page: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Settings from '../parts/Settings'

const meta: Meta = { title: 'Components/Home page' }
export default meta

export const HomePage: StoryObj = { ...Settings.HomePage, name: 'Every project' }
