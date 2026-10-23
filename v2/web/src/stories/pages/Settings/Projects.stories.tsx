// T521: the real page, Settings > Projects: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Settings/Projects', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('Projects', false)
export const Phone = screen('Projects', true)
