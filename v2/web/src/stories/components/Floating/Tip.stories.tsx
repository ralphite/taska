// T512, B515: Floating > Tip: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Frame from '../parts/Frame'

const meta: Meta = { title: 'Components/Floating/Tip' }
export default meta

export const PointingTip: StoryObj = {
  ...Frame.PointingTip,
  name: 'Pointing tip',
  parameters: { ...Frame.PointingTip.parameters, platform: 'desktop' },
}
