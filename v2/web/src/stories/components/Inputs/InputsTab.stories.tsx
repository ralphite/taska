// T512, B515: Inputs > Inputs tab: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Inputs from '../parts/Inputs'

const meta: Meta = { title: 'Components/Inputs/Inputs tab' }
export default meta

export const InputsTab: StoryObj = { ...Inputs.InputsTab, name: 'All inputs' }
export const InputsTabSearch: StoryObj = { ...Inputs.InputsTabSearch, name: 'Search' }
export const InputsTabWithOneOnItsWay: StoryObj = { ...Inputs.InputsTabWithOneOnItsWay, name: 'One on its way' }
export const InputsTabEmpty: StoryObj = { ...Inputs.InputsTabEmpty, name: 'Empty' }
