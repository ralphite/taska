// T521: the real page, Projects > Project drawer: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Projects/Project drawer',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Phone = screen('Drawer', true)
