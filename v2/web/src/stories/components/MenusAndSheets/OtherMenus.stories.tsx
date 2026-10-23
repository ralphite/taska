// T512, B515: Menus and sheets > Other menus: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Sheets from '../parts/Sheets'

const meta: Meta = { title: 'Components/Menus and sheets/Other menus' }
export default meta

export const MessageMenu: StoryObj = { ...Sheets.MessageMenu, name: 'Message' }
export const InputMenu: StoryObj = { ...Sheets.InputMenu, name: 'Input' }
export const ProjectMenu: StoryObj = { ...Sheets.ProjectMenu, name: 'Project' }
export const ViewMenu: StoryObj = { ...Sheets.ViewMenu, name: 'Your view' }
