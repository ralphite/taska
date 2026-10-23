// T521: the real page, Item page > Proposed: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Item page/Proposed', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('ItemProposed', false)
export const Phone = screen('ItemProposed', true)
