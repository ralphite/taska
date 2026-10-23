// T512, B515: Floating > Toast: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Frame from '../parts/Frame'

const meta: Meta = { title: 'Components/Floating/Toast' }
export default meta

export const ToastPlain: StoryObj = { ...Frame.ToastPlain, name: 'Plain (Copied)' }
export const ToastWithUndo: StoryObj = { ...Frame.ToastWithUndo, name: 'With Undo' }
export const ToastError: StoryObj = { ...Frame.ToastError, name: 'Error: Taska said no' }
export const ToastLong: StoryObj = { ...Frame.ToastLong, name: 'Moved, with Open' }
