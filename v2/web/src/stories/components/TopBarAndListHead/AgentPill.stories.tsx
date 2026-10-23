// T512, B515: Top bar and list head > Agent pill: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Frame from '../parts/Frame'

const meta: Meta = { title: 'Components/Top bar and list head/Agent pill' }
export default meta

export const PillWorking: StoryObj = { ...Frame.PillWorking, name: 'At work' }
export const PillReady: StoryObj = { ...Frame.PillReady, name: 'Waiting for work' }
export const PillNoAgent: StoryObj = { ...Frame.PillNoAgent, name: 'No agent' }
export const PillIdle: StoryObj = { ...Frame.PillIdle, name: 'Idle' }
export const PillOffline: StoryObj = { ...Frame.PillOffline, name: 'Offline' }
export const NotSaved: StoryObj = { ...Frame.NotSaved, name: 'Not saved count' }
