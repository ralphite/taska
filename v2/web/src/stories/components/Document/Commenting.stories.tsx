// T512, B515: Document > Commenting: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Document from '../parts/Document'

const meta: Meta = { title: 'Components/Document/Commenting' }
export default meta

export const ParagraphPicked: StoryObj = { ...Document.ParagraphPicked, name: 'Paragraph picked' }
export const WordsSelected: StoryObj = { ...Document.WordsSelected, name: 'Words selected' }
export const SelectionBar: StoryObj = { ...Document.SelectionBar, name: 'Bar over selected words' }
export const CircleToSelect: StoryObj = { ...Document.CircleToSelect, name: 'Circle to select' }
export const Replying: StoryObj = { ...Document.Replying, name: 'Replying in a thread' }
export const ResolvedThread: StoryObj = { ...Document.ResolvedThread, name: 'Thread resolved' }
export const WebPageCommentMode: StoryObj = { ...Document.WebPageCommentMode, name: 'Web page comment mode' }
export const WebPagePartPicked: StoryObj = { ...Document.WebPagePartPicked, name: 'Web page part picked' }
export const WebPageRecording: StoryObj = { ...Document.WebPageRecording, name: 'Web page part, speaking' }
export const WebPageCommentOpen: StoryObj = { ...Document.WebPageCommentOpen, name: 'Web page comment open' }
export const WebPageNotSent: StoryObj = { ...Document.WebPageNotSent, name: 'Web page part, said and not sent' }
export const WebPageCommentSaving: StoryObj = { ...Document.WebPageCommentSaving, name: 'Web page comment being saved' }
export const WebPageResolved: StoryObj = { ...Document.WebPageResolved, name: 'Web page thread resolved' }
export const WebPageNotOnPage: StoryObj = {
  ...Document.WebPageNotOnPage,
  name: 'Web page comment on a part not shown now',
}
