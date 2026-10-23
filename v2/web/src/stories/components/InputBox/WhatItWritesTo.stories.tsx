// T512, B515: Input box > What it writes to: the line on top of the box, and its words, for each thing it can write to.
// The parts module draws them.
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as InputBox from '../parts/InputBox'

const meta: Meta = { title: 'Components/Input box/What it writes to' }
export default meta

export const NewInput: StoryObj = { ...InputBox.NewInput, name: 'A new input (the New input page)' }
export const NewInputWithWords: StoryObj = { ...InputBox.NewInputWithWords, name: 'A new input, with words' }
export const ReplyToAnItem: StoryObj = { ...InputBox.ReplyToAnItem, name: 'A reply to an item' }
export const ReplyToAnItemWithWords: StoryObj = {
  ...InputBox.ReplyToAnItemWithWords,
  name: 'A reply to an item, with words',
}
export const CommentOnAParagraph: StoryObj = { ...InputBox.CommentOnAParagraph, name: 'A comment on a paragraph' }
export const CommentOnParagraphs: StoryObj = { ...InputBox.CommentOnParagraphs, name: 'A comment on two paragraphs' }
export const ReplyInAThread: StoryObj = { ...InputBox.ReplyInAThread, name: 'A reply in a comment thread' }
export const DocumentNothingPicked: StoryObj = {
  ...InputBox.DocumentNothingPicked,
  name: 'A document open, nothing picked',
}
export const CommentsNotSent: StoryObj = { ...InputBox.CommentsNotSent, name: 'Voice comments not sent yet' }
export const EditingAnInput: StoryObj = { ...InputBox.EditingAnInput, name: 'Editing an input' }
export const AddingToAnInput: StoryObj = { ...InputBox.AddingToAnInput, name: 'Adding details to an input' }
export const EditingYourComment: StoryObj = { ...InputBox.EditingYourComment, name: 'Editing your comment' }
export const CorrectingAWord: StoryObj = { ...InputBox.CorrectingAWord, name: 'Correcting a word' }
export const RecordingForAnotherItem: StoryObj = {
  ...InputBox.RecordingForAnotherItem,
  name: 'Recording for another item',
}
