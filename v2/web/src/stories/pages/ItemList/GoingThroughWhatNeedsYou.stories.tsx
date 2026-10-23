// T521: the real page, Item list > Going through what needs you: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Item list/Going through what needs you',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('GoThrough', false)
export const Phone = screen('GoThrough', true)
