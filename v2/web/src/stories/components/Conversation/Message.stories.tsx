// T512, B515: Conversation > Message: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Talk from '../parts/Talk'

const meta: Meta = { title: 'Components/Conversation/Message' }
export default meta

export const Progress: StoryObj = { ...Talk.Progress, name: 'Progress' }
export const Say: StoryObj = { ...Talk.Say, name: 'Say' }
export const YourWords: StoryObj = { ...Talk.YourWords, name: 'Your words' }
export const YourVoiceNote: StoryObj = { ...Talk.YourVoiceNote, name: 'Your voice note' }
export const Question: StoryObj = { ...Talk.Question, name: 'Question' }
export const QuestionAnswered: StoryObj = { ...Talk.QuestionAnswered, name: 'Question answered' }
export const ChecklistAnswered: StoryObj = { ...Talk.ChecklistAnswered, name: 'Checklist answered' }
export const Blocked: StoryObj = { ...Talk.Blocked, name: 'Blocked' }
export const Proposal: StoryObj = { ...Talk.Proposal, name: 'Proposal' }
export const Decision: StoryObj = { ...Talk.Decision, name: 'Decision' }
export const Withdrawn: StoryObj = { ...Talk.Withdrawn, name: 'Question taken back' }
export const TakesBack: StoryObj = { ...Talk.TakesBack, name: 'Taking a question back' }
export const LongReport: StoryObj = { ...Talk.LongReport, name: 'Long report' }
export const DoneReport: StoryObj = { ...Talk.DoneReport, name: 'Done report' }
export const FromTheOrganizer: StoryObj = { ...Talk.FromTheOrganizer, name: 'From the organizer' }
export const FromCodex: StoryObj = { ...Talk.FromCodex, name: 'From Codex' }
export const ReadByAgent: StoryObj = { ...Talk.ReadByAgent, name: 'Read by the agent' }
