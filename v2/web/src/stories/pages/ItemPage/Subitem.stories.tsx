// T521: the real page, Item page > Subitem: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Item page/Subitem', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('ItemSubitem', false)
export const Phone = screen('ItemSubitem', true)
