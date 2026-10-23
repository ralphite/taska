// T512, B515: Icons and marks > Project tile: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Basics from '../parts/Basics'

const meta: Meta = { title: 'Components/Icons and marks/Project tile' }
export default meta

export const ProjectTiles: StoryObj = { ...Basics.ProjectTiles, name: 'Project tiles' }
