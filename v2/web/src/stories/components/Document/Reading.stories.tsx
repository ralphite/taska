// T512, B515: Document > Reading: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Document from '../parts/Document'

const meta: Meta = { title: 'Components/Document/Reading' }
export default meta

export const WithComments: StoryObj = { ...Document.WithComments, name: 'With comments' }
export const LongWithOutline: StoryObj = { ...Document.LongWithOutline, name: 'Long, with contents' }
export const ContentsOpen: StoryObj = { ...Document.ContentsOpen, name: 'Contents opened' }
export const PointingAtParagraph: StoryObj = { ...Document.PointingAtParagraph, name: 'Pointing at a paragraph' }
export const PointingAtListItem: StoryObj = { ...Document.PointingAtListItem, name: 'Pointing at an item of a list' }
export const WebPage: StoryObj = { ...Document.WebPage, name: 'Web page' }
