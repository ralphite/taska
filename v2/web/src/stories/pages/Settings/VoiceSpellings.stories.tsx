// T521: the real page, Settings > Voice spellings: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Settings/Voice spellings',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('VoiceSpellings', false)
export const Phone = screen('VoiceSpellings', true)
