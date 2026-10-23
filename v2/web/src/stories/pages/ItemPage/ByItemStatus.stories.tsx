// T521: Pages > Item page > By item status: the page with one item open, in each status an item can have
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SHOP, pageParams, screen } from '../screens'

const meta: Meta = { title: 'Pages/Item page/By item status', parameters: pageParams() }
export default meta

export const InProgressWithTalk: StoryObj = { ...screen(SHOP + 'F1'), name: 'In progress, with its talk' }
/** An agent is blocked and needs you: the amber card at the end of the talk, and its row and status read Needs you
 * (R055, B535), though it is still in progress. */
export const Blocked: StoryObj = { ...screen(SHOP + 'B2'), name: 'Blocked' }
/** An agent asks you: its row and status read Needs you too. */
export const Question: StoryObj = { ...screen(SHOP + 'T7'), name: 'Question' }
/** A question with several answers to tick. */
export const ChecklistQuestion: StoryObj = { ...screen(SHOP + 'T9'), name: 'Checklist question' }
export const Proposed: StoryObj = { ...screen(SHOP + 'I4'), name: 'Proposed' }
export const WaitsForReview: StoryObj = { ...screen(SHOP + 'B6'), name: 'Waits for review' }
export const Open: StoryObj = { ...screen(SHOP + 'T3'), name: 'Open' }
export const Later: StoryObj = { ...screen(SHOP + 'F8'), name: 'Later' }
export const Done: StoryObj = { ...screen(SHOP + 'B10'), name: 'Done' }
export const WontDo: StoryObj = { ...screen(SHOP + 'T5'), name: "Won't do" }
export const Archived: StoryObj = { ...screen(SHOP + 'B21'), name: 'Archived' }
export const RuleInForce: StoryObj = { ...screen(SHOP + 'R16'), name: 'Rule in force' }
export const RuleProposed: StoryObj = { ...screen(SHOP + 'R17'), name: 'Rule proposed' }
