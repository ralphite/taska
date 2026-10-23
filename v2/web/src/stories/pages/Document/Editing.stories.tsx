// T521: the real page, Document > Editing: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Document/Editing', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('DocumentEditing', false)
export const Phone = screen('DocumentEditing', true)
