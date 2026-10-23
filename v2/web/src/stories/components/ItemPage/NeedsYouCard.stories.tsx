// T512, B515: Item page > Needs-you card: its states, the parts modules draw them
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as Item from '../parts/Item'
import * as ItemReplied from '../parts/ItemReplied'

const meta: Meta = { title: 'Components/Item page/Needs-you card' }
export default meta

export const CardQuestion: StoryObj = { ...Item.CardQuestion, name: 'Question' }
export const CardChecklist: StoryObj = { ...Item.CardChecklist, name: 'Checklist question' }
export const CardBlocked: StoryObj = { ...Item.CardBlocked, name: 'Blocked' }
export const CardProposal: StoryObj = { ...Item.CardProposal, name: 'Proposal' }
export const CardProposedNoWords: StoryObj = { ...Item.CardProposedNoWords, name: 'Proposed, nothing said' }
export const CardReview: StoryObj = { ...Item.CardReview, name: 'Waits for review' }
export const CardRule: StoryObj = { ...Item.CardRule, name: 'Rule proposed' }
export const CardDecided: StoryObj = { ...Item.CardDecided, name: 'Proposal approved' }
export const CardAccepted: StoryObj = { ...Item.CardAccepted, name: 'Work accepted' }
export const FinishedYouReplied: StoryObj = { ...ItemReplied.FinishedYouReplied, name: 'Finished, you replied' }
export const ProposalYouReplied: StoryObj = { ...ItemReplied.ProposalYouReplied, name: 'Proposal, you replied' }
