// T521: the real page, Item page > Long talk: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: 'Pages/Item page/Long talk', parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('ItemLongTalk', false)
export const Phone = screen('ItemLongTalk', true)
