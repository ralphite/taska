// T521: the real page, Item page > Won't do: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = { title: "Pages/Item page/Won't do", parameters: { layout: 'fullscreen', covers: ['ProjectPage'] } }
export default meta

export const Desktop = screen('ItemWontDo', false)
export const Phone = screen('ItemWontDo', true)
