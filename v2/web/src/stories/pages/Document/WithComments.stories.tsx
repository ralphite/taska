// T521: the real page, Document > With comments: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Document/With comments',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('DocumentWithComments', false)
export const Phone = screen('DocumentWithComments', true)
