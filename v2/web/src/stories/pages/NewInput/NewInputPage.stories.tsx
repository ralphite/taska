// T521: the real page, New input > New input page: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/New input/New input page',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('NewInput', false)
export const Phone = screen('NewInput', true)
