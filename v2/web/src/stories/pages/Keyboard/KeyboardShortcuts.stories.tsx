// T521: the real page, Keyboard > Keyboard shortcuts: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Keyboard/Keyboard shortcuts',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('KeyboardShortcuts', false)
