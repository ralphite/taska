// T512, B515: Menus and sheets > Other menus: a message's, what you said's, a project's and one of your views' menu,
// each where the page opens it; the parts module opens each the page's way
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Sheets from '../parts/Sheets'

const meta: Meta = { title: 'Components/Menus and sheets/Other menus' }
export default meta

export const MessageMenu: StoryObj = { ...Sheets.MessageMenu, name: 'Message' }
export const InputMenu: StoryObj = { ...Sheets.InputMenu, name: 'What you said' }
export const ProjectMenu: StoryObj = {
  ...Sheets.ProjectMenu,
  name: 'This project',
  parameters: { ...Sheets.ProjectMenu.parameters, platform: 'desktop' },
}
export const OtherProjectMenu: StoryObj = {
  ...Sheets.OtherProjectMenu,
  name: 'Another project',
  parameters: { ...Sheets.OtherProjectMenu.parameters, platform: 'desktop' },
}
export const ViewMenu: StoryObj = { ...Sheets.ViewMenu, name: 'One of your views' }
