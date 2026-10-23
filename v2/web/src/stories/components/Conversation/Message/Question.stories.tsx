// T512, T522: Conversation > Message > Question: an agent's question in the talk once it no longer waits on you
// (answered, skipped, changed, taken back); while it waits, it is the needs-you card (Item page > Needs-you card)
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Talk from '../../parts/Talk'

const meta: Meta = { title: 'Components/Conversation/Message/Question' }
export default meta

export const Answered: StoryObj = { ...Talk.AskAnswered, name: 'Answered' }
export const AnsweredPointed: StoryObj = { ...Talk.AskAnsweredPointed, name: 'Answered, pointer on it: Modify' }
export const ChecklistAnswered: StoryObj = { ...Talk.AskChecklistAnswered, name: 'Checklist answered' }
export const Skipped: StoryObj = { ...Talk.AskSkipped, name: 'Skipped: you replied instead' }
export const Modifying: StoryObj = { ...Talk.AskModifying, name: 'Changing the answer' }
export const AnswerGoing: StoryObj = { ...Talk.AskAnswerGoing, name: 'New answer on its way' }
export const AnsweredApprove: StoryObj = { ...Talk.AskAnsweredApprove, name: 'Answered, Approve beside it' }
export const AnsweredApprovePointed: StoryObj = {
  ...Talk.AskAnsweredApprovePointed,
  name: 'Answered, pointer on Approve',
}
export const PlainAnswered: StoryObj = { ...Talk.AskPlainAnswered, name: 'No choices, answered by your words' }
export const NotAnswered: StoryObj = { ...Talk.AskNotAnswered, name: 'Not answered, asked again later' }
export const TakenBack: StoryObj = { ...Talk.AskTakenBack, name: 'Taken back by the agent' }
