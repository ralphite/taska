// T512, B515: Menus and sheets > Item menu: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Sheets from '../parts/Sheets'

const meta: Meta = { title: 'Components/Menus and sheets/Item menu' }
export default meta

export const ItemMenuPhone: StoryObj = {
  ...Sheets.ItemMenuPhone,
  name: 'On the phone',
  parameters: { ...Sheets.ItemMenuPhone.parameters, platform: 'phone' },
}
export const ItemMenuPriority: StoryObj = {
  ...Sheets.ItemMenuPriority,
  name: 'Priority on the phone',
  parameters: { ...Sheets.ItemMenuPriority.parameters, platform: 'phone' },
}
export const ItemMenuDesktop: StoryObj = {
  ...Sheets.ItemMenuDesktop,
  name: 'On the desktop',
  parameters: { ...Sheets.ItemMenuDesktop.parameters, platform: 'desktop' },
}
export const ItemMenuStatus: StoryObj = {
  ...Sheets.ItemMenuStatus,
  name: 'Status list',
  parameters: { ...Sheets.ItemMenuStatus.parameters, platform: 'desktop' },
}
export const ItemMenuDeleteAsks: StoryObj = {
  ...Sheets.ItemMenuDeleteAsks,
  name: 'Delete asks again',
  parameters: { ...Sheets.ItemMenuDeleteAsks.parameters, platform: 'desktop' },
}
