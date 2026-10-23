// T521: the real page, Item page > In progress, with its talk: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Item page/In progress, with its talk',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('ItemInProgressWithTalk', false)
export const Phone = screen('ItemInProgressWithTalk', true)
