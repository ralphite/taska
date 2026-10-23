// T521: the real page, Document > Web page: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Document/Web page', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('DocumentWebPage', false)
export const Phone = screen('DocumentWebPage', true)
