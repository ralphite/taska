// T512, B515: Side lists: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Settings from '../parts/Settings'

const meta: Meta = { title: 'Components/Side lists' }
export default meta

export const ListDocuments: StoryObj = {
  ...Settings.ListDocuments,
  name: 'Documents',
  parameters: { ...Settings.ListDocuments.parameters, platform: 'desktop' },
}
export const ListActivity: StoryObj = {
  ...Settings.ListActivity,
  name: 'Activity',
  parameters: { ...Settings.ListActivity.parameters, platform: 'desktop' },
}
export const ListDeleted: StoryObj = {
  ...Settings.ListDeleted,
  name: 'Deleted',
  parameters: { ...Settings.ListDeleted.parameters, platform: 'desktop' },
}
export const ListDeletedPicked: StoryObj = {
  ...Settings.ListDeletedPicked,
  name: 'Deleted, one picked',
  parameters: { ...Settings.ListDeletedPicked.parameters, platform: 'desktop' },
}
