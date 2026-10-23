// T512, B515: Top bar and list head > Filters: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Frame from '../parts/Frame'

const meta: Meta = { title: 'Components/Top bar and list head/Filters' }
export default meta

export const FiltersStrip: StoryObj = {
  ...Frame.FiltersStrip,
  name: 'Strip on the phone',
  parameters: { ...Frame.FiltersStrip.parameters, platform: 'phone' },
}
export const FiltersOpen: StoryObj = {
  ...Frame.FiltersOpen,
  name: 'Panel on the desktop',
  parameters: { ...Frame.FiltersOpen.parameters, platform: 'desktop' },
}
export const FilterChipsAndDot: StoryObj = { ...Frame.FilterChipsAndDot, name: 'Chips' }
