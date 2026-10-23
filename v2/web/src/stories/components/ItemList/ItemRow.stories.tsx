// T512, B515: Item list > Item row: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as List from '../parts/List'

const meta: Meta = { title: 'Components/Item list/Item row' }
export default meta

export const RowOpen: StoryObj = { ...List.RowOpen, name: 'Open' }
export const RowInProgress: StoryObj = { ...List.RowInProgress, name: 'In progress' }
export const RowInProgressQuiet: StoryObj = { ...List.RowInProgressQuiet, name: 'In progress, agent quiet' }
export const RowProposed: StoryObj = { ...List.RowProposed, name: 'Proposed' }
export const RowWaitsForReview: StoryObj = { ...List.RowWaitsForReview, name: 'Waits for review' }
export const RowDone: StoryObj = { ...List.RowDone, name: 'Done' }
export const RowWontDo: StoryObj = { ...List.RowWontDo, name: "Won't do" }
export const RowArchived: StoryObj = { ...List.RowArchived, name: 'Archived' }
export const RowSubitem: StoryObj = { ...List.RowSubitem, name: 'Subitem' }
export const RowLater: StoryObj = { ...List.RowLater, name: 'Later' }
export const RowRule: StoryObj = { ...List.RowRule, name: 'Rule' }
export const RowWithPicture: StoryObj = { ...List.RowWithPicture, name: 'With a picture' }
export const RowWithDraft: StoryObj = { ...List.RowWithDraft, name: 'With a draft' }
export const RowUnread: StoryObj = { ...List.RowUnread, name: 'New from an agent' }
export const RowCurrent: StoryObj = { ...List.RowCurrent, name: 'Open in the pane' }
export const RowPicked: StoryObj = { ...List.RowPicked, name: 'Picked' }
export const RowHover: StoryObj = {
  ...List.RowHover,
  name: 'Pointer on it',
  parameters: { ...List.RowHover.parameters, platform: 'desktop' },
}
export const RowP0: StoryObj = { ...List.RowP0, name: 'P0' }
export const RowP3: StoryObj = { ...List.RowP3, name: 'P3' }
export const RowLongChineseTitle: StoryObj = { ...List.RowLongChineseTitle, name: 'Long Chinese title' }
export const RowLongEnglishTitle: StoryObj = { ...List.RowLongEnglishTitle, name: 'Long English title' }
