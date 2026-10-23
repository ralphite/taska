// T521: the real page, Item page > Writing a reply: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Item page/Writing a reply',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('ItemReplying', false)
export const Phone = screen('ItemReplying', true)
