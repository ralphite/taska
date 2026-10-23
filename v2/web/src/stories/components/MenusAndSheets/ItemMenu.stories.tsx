// T512, B515: Menus and sheets > Item menu: an item's ⋯ and its chips, on the item's page, desktop and phone side by
// side (R520); the parts module opens each the page's way
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Sheets from '../parts/Sheets'

const meta: Meta = { title: 'Components/Menus and sheets/Item menu' }
export default meta

export const ItemInProgress: StoryObj = { ...Sheets.ItemInProgress, name: 'Item in progress' }
export const Status: StoryObj = { ...Sheets.Status, name: 'Status' }
export const Priority: StoryObj = { ...Sheets.Priority, name: 'Priority' }
export const Type: StoryObj = { ...Sheets.Type, name: 'Type' }
export const DeleteAsks: StoryObj = { ...Sheets.DeleteAsks, name: 'Delete asks again' }
export const ItemDone: StoryObj = { ...Sheets.ItemDone, name: 'Item done' }
export const ItemLater: StoryObj = { ...Sheets.ItemLater, name: 'Item for later' }
export const Subitem: StoryObj = { ...Sheets.Subitem, name: 'Subitem' }
export const ItemArchived: StoryObj = { ...Sheets.ItemArchived, name: 'Item archived' }
export const Rule: StoryObj = { ...Sheets.Rule, name: 'Rule' }
export const RightClickOnARow: StoryObj = {
  ...Sheets.RightClickOnARow,
  name: 'Right-click on a row',
  parameters: { ...Sheets.RightClickOnARow.parameters, platform: 'desktop' },
}
/** T522 (r731): a row under the pointer, from the keys (Tab), pressed (desktop). */
export const ItemMenuPointed: StoryObj = {
  ...Sheets.ItemMenuPointed,
  name: 'Pointer on a row',
  parameters: { ...Sheets.ItemMenuPointed.parameters, platform: 'desktop' },
}
export const ItemMenuKeys: StoryObj = {
  ...Sheets.ItemMenuKeys,
  name: 'Keys: Tab on a row',
  parameters: { ...Sheets.ItemMenuKeys.parameters, platform: 'desktop' },
}
export const ItemMenuPressed: StoryObj = { ...Sheets.ItemMenuPressed, name: 'A row pressed' }
export const StatusPointed: StoryObj = {
  ...Sheets.StatusPointed,
  name: 'Status, pointer on a choice',
  parameters: { ...Sheets.StatusPointed.parameters, platform: 'desktop' },
}
export const StatusPointedOnPicked: StoryObj = {
  ...Sheets.StatusPointedOnPicked,
  name: 'Status, pointer on the ticked one',
  parameters: { ...Sheets.StatusPointedOnPicked.parameters, platform: 'desktop' },
}
