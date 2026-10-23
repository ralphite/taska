// T512, B515: Item page > By item status: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Item from '../parts/Item'

const meta: Meta = { title: 'Components/Item page/By item status' }
export default meta

export const Open: StoryObj = { ...Item.Open, name: 'Open' }
export const InProgressWithTalk: StoryObj = { ...Item.InProgressWithTalk, name: 'In progress, with its talk' }
export const Blocked: StoryObj = { ...Item.Blocked, name: 'Blocked' }
export const Question: StoryObj = { ...Item.Question, name: 'Question' }
export const ChecklistQuestion: StoryObj = { ...Item.ChecklistQuestion, name: 'Checklist question' }
export const ProposedWithPreview: StoryObj = { ...Item.ProposedWithPreview, name: 'Proposed, with a preview' }
export const ProposedEmpty: StoryObj = { ...Item.ProposedEmpty, name: 'Proposed, nothing said' }
export const WaitsForReview: StoryObj = { ...Item.WaitsForReview, name: 'Waits for review' }
export const Done: StoryObj = { ...Item.Done, name: 'Done' }
export const WontDo: StoryObj = { ...Item.WontDo, name: "Won't do" }
export const Later: StoryObj = { ...Item.Later, name: 'Later' }
export const Archived: StoryObj = { ...Item.Archived, name: 'Archived' }
export const RuleInForce: StoryObj = { ...Item.RuleInForce, name: 'Rule in force' }
export const RuleProposed: StoryObj = { ...Item.RuleProposed, name: 'Rule proposed' }
