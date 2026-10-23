// T521: the real page, Inputs > Inputs tab: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Inputs/Inputs tab', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('Inputs', false)
export const Phone = screen('Inputs', true)
