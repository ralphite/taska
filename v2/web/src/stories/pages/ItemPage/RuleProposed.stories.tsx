// T521: the real page, Item page > Rule proposed: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Item page/Rule proposed',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('RuleProposed', false)
export const Phone = screen('RuleProposed', true)
