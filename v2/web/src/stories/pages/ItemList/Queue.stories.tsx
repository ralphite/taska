// T521: the real page, Item list > Queue: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Item list/Queue', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('ItemsQueue', false)
export const Phone = screen('ItemsQueue', true)
