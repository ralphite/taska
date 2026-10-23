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
/** T522 (r731): every look under the pointer, the keyboard, a press, side by side. */
export const ProjectBarLooks: StoryObj = { ...Frame.ProjectBarLooks, name: 'Pointer, keys, pressed: all side by side' }
