// T521: the real page, Item list > Filtered: bugs: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Item list/Filtered: bugs',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('ItemsFilters', false)
export const Phone = screen('ItemsFilters', true)
