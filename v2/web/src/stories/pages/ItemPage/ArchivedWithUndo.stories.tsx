// T521: the real page, Item page > Archived, with Undo: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Item page/Archived, with Undo',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('ArchivedToast', false)
export const Phone = screen('ArchivedToast', true)
