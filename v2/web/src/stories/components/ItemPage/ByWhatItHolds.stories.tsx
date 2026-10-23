// T512, B515: Item page > By what it holds: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Item from '../parts/Item'

const meta: Meta = { title: 'Components/Item page/By what it holds' }
export default meta

export const Subitem: StoryObj = { ...Item.Subitem, name: 'Subitem' }
export const WithSubitemsAndDocument: StoryObj = { ...Item.WithSubitemsAndDocument, name: 'Subitems and a document' }
export const DocumentChoicesNotSent: StoryObj = {
  ...Item.DocumentChoicesNotSent,
  name: 'A document with a choice not sent',
}
export const SubitemInLater: StoryObj = { ...Item.SubitemInLater, name: 'A subitem in Later' }
export const LongTalk: StoryObj = { ...Item.LongTalk, name: 'Long talk' }
export const WithPictures: StoryObj = { ...Item.WithPictures, name: 'Pictures' }
export const QuestionWithdrawn: StoryObj = { ...Item.QuestionWithdrawn, name: 'Question taken back' }
export const Decided: StoryObj = { ...Item.Decided, name: 'Proposal decided' }
