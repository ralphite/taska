// T521: the real page, Settings > Organizer: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Settings/Organizer', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('Organizer', false)
export const Phone = screen('Organizer', true)
