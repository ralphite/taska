// T521: the real page, Document > Long, with contents: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Document/Long, with contents',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('DocumentLong', false)
export const Phone = screen('DocumentLong', true)
