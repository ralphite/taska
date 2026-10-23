// T512, B515: Top bar and list head > Project bar: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Frame from '../parts/Frame'

const meta: Meta = { title: 'Components/Top bar and list head/Project bar' }
export default meta

export const ProjectBar: StoryObj = {
  ...Frame.ProjectBar,
  name: 'Project bar',
  parameters: { ...Frame.ProjectBar.parameters, platform: 'desktop' },
}
