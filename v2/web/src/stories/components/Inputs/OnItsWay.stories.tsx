// T512, B515: Inputs > On its way: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Inputs from '../parts/Inputs'

const meta: Meta = { title: 'Components/Inputs/On its way' }
export default meta

export const OnItsWay: StoryObj = { ...Inputs.OnItsWay, name: 'Sending, not sent, waiting' }
