// T522, R531: Document > Comment threads: a thread's states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Document from '../parts/Document'

const meta: Meta = { title: 'Components/Document/Comment threads' }
export default meta

export const ThreadOpened: StoryObj = { ...Document.ThreadOpened, name: 'Opened from its count' }
export const NewReply: StoryObj = { ...Document.NewReply, name: 'Answered by an agent' }
export const PointingAtYourComment: StoryObj = {
  ...Document.PointingAtYourComment,
  name: 'Pointing at your comment: Edit, Move, Delete',
}
export const CommentWithFiles: StoryObj = { ...Document.CommentWithFiles, name: 'With a picture and a voice note' }
export const ResolvedOpened: StoryObj = { ...Document.ResolvedOpened, name: 'Resolved, opened again' }
export const TextChanged: StoryObj = { ...Document.TextChanged, name: 'Its text changed' }
export const NotSentYet: StoryObj = { ...Document.NotSentYet, name: 'Not sent yet' }
