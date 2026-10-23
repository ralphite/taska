// T512, B515: Floating > Picture viewer: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Frame from '../parts/Frame'

const meta: Meta = { title: 'Components/Floating/Picture viewer' }
export default meta

export const PictureViewer: StoryObj = { ...Frame.PictureViewer, name: 'Picture viewer' }
