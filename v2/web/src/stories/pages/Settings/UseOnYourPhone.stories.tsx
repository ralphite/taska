// T521: the real page, Settings > Use on your phone: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Settings/Use on your phone',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('UseOnYourPhone', false)
export const Phone = screen('UseOnYourPhone', true)
