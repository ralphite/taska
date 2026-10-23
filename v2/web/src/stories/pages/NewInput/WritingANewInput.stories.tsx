// T521: the real page, New input > Writing a new input: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/New input/Writing a new input',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('NewInputWriting', false)
export const Phone = screen('NewInputWriting', true)
