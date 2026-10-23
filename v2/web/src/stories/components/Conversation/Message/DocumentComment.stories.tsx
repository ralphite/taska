// T512, T522: Conversation > Message > Document comment: a comment on one of the item's documents, as the talk shows
// it among the messages, in time (T274 #4)
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Talk from '../../parts/Talk'

const meta: Meta = { title: 'Components/Conversation/Message/Document comment' }
export default meta

export const Yours: StoryObj = { ...Talk.CommentYours, name: 'Yours, with what it is about' }
export const Agent: StoryObj = { ...Talk.CommentAgent, name: "An agent's answer" }
export const WholeDoc: StoryObj = { ...Talk.CommentWholeDoc, name: 'On the whole document' }
export const OnTable: StoryObj = { ...Talk.CommentOnTable, name: 'About a table' }
export const Voice: StoryObj = { ...Talk.CommentVoice, name: 'Voice comment, no words heard' }
