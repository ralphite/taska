// T521: the real page, Item list > Active: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Item list/Active', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('ItemsActive', false)
export const Phone = screen('ItemsActive', true)
