// T521: the real page, Item page > Waits for review: on the desktop and on the phone
import type { Meta } from '@storybook/react-vite'
import { screen } from '../screens'

const meta: Meta = {
  title: 'Pages/Item page/Waits for review',
  parameters: { layout: 'fullscreen', covers: ['ProjectPage'] },
}
export default meta

export const Desktop = screen('ItemWaitsForReview', false)
export const Phone = screen('ItemWaitsForReview', true)
