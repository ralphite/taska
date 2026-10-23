// T512, B515: Inputs > New input page: its parts, the parts modules draw them. The whole page with its box is Input
// box > What it writes to > A new input (T529: one story for one screen).
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Inputs from '../parts/Inputs'

const meta: Meta = { title: 'Components/Inputs/New input page' }
export default meta

export const SaidLatelyList: StoryObj = { ...Inputs.SaidLatelyList, name: 'You said lately' }
export const ProjectHead: StoryObj = { ...Inputs.ProjectHead, name: 'Project name' }
/** T522 (r731): a line you said under the pointer, from the keys, its buttons pointed at. */
export const SaidLooks: StoryObj = { ...Inputs.SaidLooks, name: 'You said lately: pointer, keys' }
