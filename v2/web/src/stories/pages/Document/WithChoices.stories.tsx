// T521: the real page, Document > With choices: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Document/With choices',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('DocumentWithChoices', false)
export const Phone = screen('DocumentWithChoices', true)
