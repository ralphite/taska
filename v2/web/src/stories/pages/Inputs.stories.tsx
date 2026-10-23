// T521: Pages > Inputs: the New input page (what you said lately under the box) and the phone's Inputs tab
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SHOP, pageParams, screen } from './screens'

const meta: Meta = { title: 'Pages/Inputs', parameters: pageParams() }
export default meta

/** The desktop's page with nothing open; the phone writes a new input in the box under its list (Item list). */
export const NewInputPage: StoryObj = { ...screen(SHOP + 'new', 'desktop'), name: 'New input page' }
/** The phone has a tab of its own for your inputs; the desktop lists them on the New input page. */
export const InputsTab: StoryObj = { ...screen(SHOP + 'inputs', 'phone'), name: 'Inputs tab' }
