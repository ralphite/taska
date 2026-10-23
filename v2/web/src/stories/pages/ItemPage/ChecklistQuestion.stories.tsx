// T521: the real page, Item page > Checklist question: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Item page/Checklist question',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('ItemChecklistQuestion', false)
export const Phone = screen('ItemChecklistQuestion', true)
