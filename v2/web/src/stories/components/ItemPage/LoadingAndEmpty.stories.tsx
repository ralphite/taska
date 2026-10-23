// T522 (r717): Item page > Loading and empty: the pane with no item to show, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Item from '../parts/Item'

const meta: Meta = { title: 'Components/Item page/Loading and empty' }
export default meta

export const Loading: StoryObj = { ...Item.Loading, name: 'Loading (after a reload)' }
export const NotThere: StoryObj = { ...Item.NotThere, name: 'Not in this project' }
export const NothingPicked: StoryObj = {
  ...Item.NothingPicked,
  name: 'Nothing picked',
  parameters: { ...Item.NothingPicked.parameters, platform: 'desktop' },
}
