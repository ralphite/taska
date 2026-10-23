// T512, B515: Inputs > New input page: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Inputs from '../parts/Inputs'

const meta: Meta = { title: 'Components/Inputs/New input page' }
export default meta

export const NewInputPage: StoryObj = { ...Inputs.NewInputPage, name: 'New input page' }
export const SaidLatelyList: StoryObj = { ...Inputs.SaidLatelyList, name: 'You said lately' }
export const ProjectHead: StoryObj = { ...Inputs.ProjectHead, name: 'Project name' }
