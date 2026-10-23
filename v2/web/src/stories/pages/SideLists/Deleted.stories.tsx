// T521: the real page, Side lists > Deleted: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Side lists/Deleted', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('Deleted', false)
export const Phone = screen('Deleted', true)
