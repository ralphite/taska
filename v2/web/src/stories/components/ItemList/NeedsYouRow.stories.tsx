// T512, B515: Item list > Needs-you row: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as List from '../parts/List'

const meta: Meta = { title: 'Components/Item list/Needs-you row' }
export default meta

/** T522 (r731): every look under the pointer, the keyboard, a press, picked, open, dragged, side by side. */
export const NeedsLooks: StoryObj = { ...List.NeedsLooks, name: 'Pointer, keys, picked, dragged: all side by side' }
export const NeedsQuestion: StoryObj = { ...List.NeedsQuestion, name: 'Question' }
export const NeedsChecklist: StoryObj = { ...List.NeedsChecklist, name: 'Checklist question' }
export const NeedsBlocked: StoryObj = { ...List.NeedsBlocked, name: 'Blocked' }
export const NeedsProposed: StoryObj = { ...List.NeedsProposed, name: 'Proposed' }
export const NeedsReview: StoryObj = { ...List.NeedsReview, name: 'Waits for review' }
export const NeedsRuleProposed: StoryObj = { ...List.NeedsRuleProposed, name: 'Rule proposed' }
