// T521: the real page, Projects > Empty project: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Projects/Empty project',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('EmptyProject', false)
export const Phone = screen('EmptyProject', true)
