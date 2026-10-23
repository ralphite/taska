// T521: the real page, Item list > All: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Item list/All', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('ItemsAll', false)
export const Phone = screen('ItemsAll', true)
