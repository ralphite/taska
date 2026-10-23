// T521: the real page, Item list > Needs you: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Item list/Needs you', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('ItemsNeedsYou', false)
export const Phone = screen('ItemsNeedsYou', true)
